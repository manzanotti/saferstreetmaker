import type { StoredMapRecord } from '../../services/MapDatabase';

export interface StorageMapDownloaderOptions {
    loadLastMapSelected: () => Promise<string>;
    getCurrentTitle: () => string;
    loadRawMapFromStorage: (mapName: string) => Promise<StoredMapRecord | null>;
    showErrors: (errors: string[]) => void;
}

export class StorageMapDownloader {
    private readonly options: StorageMapDownloaderOptions;

    constructor(options: StorageMapDownloaderOptions) {
        this.options = options;
    }

    async download(): Promise<void> {
        let storedMapRecord: StoredMapRecord | null;

        try {
            const lastMapSelected = await this.options.loadLastMapSelected();
            const mapName = lastMapSelected || this.options.getCurrentTitle();
            storedMapRecord = await this.options.loadRawMapFromStorage(mapName);
            if (storedMapRecord === null) {
                throw new Error(`Stored map "${mapName}" was not found.`);
            }
        } catch (error) {
            this.options.showErrors(
                buildErrors('There was a problem loading the map from browser storage:', error)
            );
            return;
        }

        try {
            const mapString = JSON.stringify(storedMapRecord);
            const blob = new Blob([mapString], { type: 'application/json;charset=utf-8' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.href = url;
            link.download = 'invalidMapData.json';
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 0);
        } catch (error) {
            this.options.showErrors(
                buildErrors('There was a problem preparing the map download:', error)
            );
        }
    }
}

function buildErrors(intro: string, error: unknown): string[] {
    const errors = [intro, getErrorMessage(error)];
    const stack = getErrorStack(error);
    if (stack) {
        errors.push(stack);
    }
    return errors;
}

function getErrorMessage(error: unknown): string {
    return String((error as { message?: unknown } | null | undefined)?.message ?? error);
}

function getErrorStack(error: unknown): string | null {
    const stack = (error as { stack?: unknown } | null | undefined)?.stack;
    return stack == null ? null : String(stack);
}
