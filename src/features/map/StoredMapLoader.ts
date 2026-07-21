import type { SerializedMap } from '../../services/MapSerializer';

export interface StoredMapLoaderOptions {
    loadMapFromStorage: (mapName: string) => Promise<SerializedMap | null>;
    hasMapInStorage: (mapName: string) => Promise<boolean>;
    clearAndReset: () => void;
    loadMapData: (mapData: SerializedMap | null) => boolean;
    buildSnapshot: () => SerializedMap;
    setLastSavedSnapshot: (snapshot: SerializedMap) => void;
    activateHistory: (mapTitle: string) => Promise<void>;
    getCurrentTitle: () => string;
    persistMap: () => Promise<void>;
    showErrors: (errors: string[], options: { showDownloadStorageLink: boolean }) => void;
}

export class StoredMapLoader {
    private readonly options: StoredMapLoaderOptions;

    constructor(options: StoredMapLoaderOptions) {
        this.options = options;
    }

    async load(mapName: string): Promise<boolean> {
        this.options.clearAndReset();

        try {
            const mapData = await this.options.loadMapFromStorage(mapName);
            const loaded = this.options.loadMapData(mapData);
            if (!loaded) {
                await this.showInvalidMapError(mapName, mapData);
                return false;
            }

            this.options.setLastSavedSnapshot(this.options.buildSnapshot());
            await this.options.activateHistory(this.options.getCurrentTitle());

            try {
                await this.options.persistMap();
            } catch (error) {
                const errors = ['There was a problem saving the map:', getErrorMessage(error)];
                const stack = getErrorStack(error);
                if (stack) {
                    errors.push(stack);
                }
                this.options.showErrors(errors, { showDownloadStorageLink: false });
                return false;
            }

            return true;
        } catch (error) {
            const errors = ['There was a problem loading the map:', getErrorMessage(error)];
            const stack = getErrorStack(error);
            if (stack) {
                errors.push(stack);
            }
            this.options.showErrors(errors, { showDownloadStorageLink: false });
            return false;
        }
    }

    private async showInvalidMapError(
        mapName: string,
        mapData: SerializedMap | null
    ): Promise<void> {
        const canDownloadStorageMap = await this.options
            .hasMapInStorage(mapName)
            .catch(() => false);
        const errors = ['There was a problem loading the map:'];
        errors.push(
            mapData === null
                ? `Stored map "${mapName}" was not found. It may have been deleted in another tab.`
                : `Stored map "${mapName}" could not be processed. It may be corrupted.`
        );
        this.options.showErrors(errors, {
            showDownloadStorageLink: canDownloadStorageMap
        });
    }
}

function getErrorMessage(error: unknown): string {
    return String((error as { message?: unknown } | null | undefined)?.message ?? error);
}

function getErrorStack(error: unknown): string | null {
    const stack = (error as { stack?: unknown } | null | undefined)?.stack;
    return stack == null ? null : String(stack);
}
