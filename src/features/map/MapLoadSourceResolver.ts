import type { FileManager } from '../../services/FileManager';
import type { SerializedMap } from '../../services/MapSerializer';

export interface ResolvedMapSource {
    geoJSON: SerializedMap | null;
    errorIntro: string;
    loadingFromStorage: boolean;
    storageMapName: string;
}

export class MapLoadSourceError extends Error {
    readonly loadingFromStorage: boolean;
    readonly storageMapName: string;

    constructor(
        message: string,
        loadingFromStorage: boolean,
        storageMapName: string,
        stack?: string
    ) {
        super(message);
        this.name = 'MapLoadSourceError';
        if (stack) {
            this.stack = stack;
        }
        this.loadingFromStorage = loadingFromStorage;
        this.storageMapName = storageMapName;
    }
}

export class MapLoadSourceResolver {
    private readonly fileManager: FileManager;
    private readonly getCurrentTitle: () => string;

    constructor(fileManager: FileManager, getCurrentTitle: () => string) {
        this.fileManager = fileManager;
        this.getCurrentTitle = getCurrentTitle;
    }

    async resolve(remoteMapFile: string | null, hash: string): Promise<ResolvedMapSource> {
        if (remoteMapFile) {
            return {
                geoJSON: await this.fileManager.loadMapFromRemoteFile(remoteMapFile),
                errorIntro: 'There was a problem loading the map from the remote file location:',
                loadingFromStorage: false,
                storageMapName: ''
            };
        }

        if (hash !== '') {
            return {
                geoJSON: this.fileManager.loadMapFromHash(hash.slice(1)),
                errorIntro: 'There was a problem loading the map from the hash:',
                loadingFromStorage: false,
                storageMapName: ''
            };
        }

        const lastMapSelected = await this.fileManager.loadLastMapSelected();
        const storageMapName = lastMapSelected || this.getCurrentTitle();
        try {
            return {
                geoJSON: await this.fileManager.loadMapFromStorage(storageMapName),
                errorIntro: 'There was a problem loading the map from browser storage:',
                loadingFromStorage: true,
                storageMapName
            };
        } catch (error) {
            throw new MapLoadSourceError(
                String((error as { message?: unknown } | null | undefined)?.message ?? error),
                true,
                storageMapName,
                (error as { stack?: unknown } | null | undefined)?.stack == null
                    ? undefined
                    : String((error as { stack: unknown }).stack)
            );
        }
    }
}
