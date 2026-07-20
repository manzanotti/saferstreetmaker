import type { SerializedMap } from '../../services/MapSerializer';
import { MapLoadSourceError, type MapLoadSourceResolver } from './MapLoadSourceResolver';

export interface MapLoadCoordinatorOptions {
    sourceResolver: Pick<MapLoadSourceResolver, 'resolve'>;
    resetMap: () => void;
    loadMapData: (
        geoJSON: SerializedMap | null,
        zoom: string | null,
        centre: number[] | null
    ) => boolean;
    buildSnapshot: () => SerializedMap;
    setLastSavedSnapshot: (snapshot: SerializedMap) => void;
    activateHistory: (title: string) => Promise<void>;
    getActiveHistoryTitle: () => string | null;
    getCurrentTitle: () => string;
    setHideToolbar: (hideToolbar: boolean) => void;
    hasMapInStorage: (mapName: string) => Promise<boolean>;
    showErrors: (errors: string[], options: { showDownloadStorageLink: boolean }) => void;
}

export class MapLoadCoordinator {
    private readonly options: MapLoadCoordinatorOptions;
    private mapInitialised = false;

    constructor(options: MapLoadCoordinatorOptions) {
        this.options = options;
    }

    async load(
        remoteMapFile: string | null,
        hash: string,
        hideToolbar: boolean,
        zoom: string | null,
        centre: number[] | null
    ): Promise<boolean> {
        this.prepareMap();

        const errorIntro = this.getInitialErrorIntro(remoteMapFile, hash);
        let mapLoaded = false;
        let sourceErrorIntro = errorIntro;
        let loadingFromStorage = false;
        let storageMapName = '';

        try {
            const source = await this.options.sourceResolver.resolve(remoteMapFile, hash);
            loadingFromStorage = source.loadingFromStorage;
            storageMapName = source.storageMapName;
            sourceErrorIntro = 'There was a problem processing the map file:';
            mapLoaded = this.options.loadMapData(source.geoJSON, zoom, centre);
            if (mapLoaded) {
                this.options.setLastSavedSnapshot(this.options.buildSnapshot());
                await this.options.activateHistory(this.options.getCurrentTitle());
            } else {
                const canDownloadStorageMap =
                    loadingFromStorage && storageMapName !== ''
                        ? await this.options.hasMapInStorage(storageMapName).catch(() => false)
                        : false;
                this.options.showErrors(
                    [sourceErrorIntro, 'The map data could not be processed. It may be corrupted.'],
                    { showDownloadStorageLink: canDownloadStorageMap }
                );
            }
        } catch (error) {
            if (error instanceof MapLoadSourceError) {
                loadingFromStorage = error.loadingFromStorage;
                storageMapName = error.storageMapName;
            }

            const canDownloadStorageMap =
                loadingFromStorage && storageMapName !== ''
                    ? await this.options.hasMapInStorage(storageMapName).catch(() => false)
                    : false;
            this.options.showErrors([sourceErrorIntro, ...getErrorDetails(error)], {
                showDownloadStorageLink: canDownloadStorageMap
            });
        }

        if (this.options.getActiveHistoryTitle() === null) {
            this.options.setLastSavedSnapshot(this.options.buildSnapshot());
            await this.options.activateHistory(this.options.getCurrentTitle());
        }

        this.options.setHideToolbar(hideToolbar);
        return mapLoaded;
    }

    private prepareMap(): void {
        if (this.mapInitialised) {
            this.options.resetMap();
        } else {
            this.mapInitialised = true;
        }
    }

    private getInitialErrorIntro(remoteMapFile: string | null, hash: string): string {
        if (remoteMapFile) {
            return 'There was a problem loading the map from the remote file location:';
        }
        if (hash !== '') {
            return 'There was a problem loading the map from the hash:';
        }
        return 'There was a problem loading the map from browser storage:';
    }
}

function getErrorDetails(error: unknown): string[] {
    const details = [getErrorMessage(error)];
    const stack = getErrorStack(error);
    if (stack) {
        details.push(stack);
    }
    return details;
}

function getErrorMessage(error: unknown): string {
    return String((error as { message?: unknown } | null | undefined)?.message ?? error);
}

function getErrorStack(error: unknown): string | null {
    const stack = (error as { stack?: unknown } | null | undefined)?.stack;
    return stack == null ? null : String(stack);
}
