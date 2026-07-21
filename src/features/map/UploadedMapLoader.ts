import type { SerializedMap } from '../../services/MapSerializer';

export interface UploadedMapLoaderOptions {
    closePanel: () => void;
    clearAndReset: () => void;
    loadMapData: (mapData: SerializedMap | null) => boolean;
    saveMap: () => Promise<void>;
    showErrors: (errors: string[]) => void;
}

export class UploadedMapLoader {
    private readonly options: UploadedMapLoaderOptions;

    constructor(options: UploadedMapLoaderOptions) {
        this.options = options;
    }

    load(data: unknown): void {
        this.options.closePanel();
        this.options.clearAndReset();

        try {
            const loaded = this.options.loadMapData(data as SerializedMap | null);
            if (loaded) {
                void this.options.saveMap().catch((error) => {
                    this.options.showErrors(this.buildSaveErrors(error));
                });
            } else {
                this.options.showErrors([
                    'There was a problem processing the uploaded map file:',
                    'The map data could not be processed. It may be corrupted.'
                ]);
            }
        } catch (error) {
            const errors = [
                'There was a problem loading the map from uploaded file:',
                this.getErrorMessage(error)
            ];
            const errorStack = this.getErrorStack(error);
            if (errorStack) {
                errors.push(errorStack);
            }
            this.options.showErrors(errors);
        }
    }

    private getErrorMessage(error: unknown): string {
        return String((error as { message?: unknown } | null | undefined)?.message ?? error);
    }

    private getErrorStack(error: unknown): string | null {
        const stack = (error as { stack?: unknown } | null | undefined)?.stack;
        return stack == null ? null : String(stack);
    }

    private buildSaveErrors(error: unknown): string[] {
        const errors = ['There was a problem saving the map:', this.getErrorMessage(error)];
        const errorStack = this.getErrorStack(error);
        if (errorStack) {
            errors.push(errorStack);
        }
        return errors;
    }
}
