import { snapshotsEqualForHistory } from '../../services/history/mapSnapshot';
import type { SerializedMap } from '../../services/MapSerializer';
import { SAVE_ERROR_ALREADY_SHOWN } from '../../composables/saveErrorMarker';

export interface PersistenceMutation {
    kind: string;
    layerId: string;
    payload?: unknown;
}

export interface MapPersistenceCoordinatorOptions {
    saveMap: () => Promise<void>;
    buildSnapshot: () => SerializedMap;
    getLastSavedSnapshot: () => SerializedMap | null;
    setLastSavedSnapshot: (snapshot: SerializedMap) => void;
    getMutation: () => PersistenceMutation | undefined;
    clearMutation: () => void;
    pruneDanglingGroupMembers: () => void;
    isHistorySuppressed: () => boolean;
    getActiveHistoryTitle: () => string | null;
    recordCheckpoint: (
        mapTitle: string,
        before: SerializedMap,
        after: SerializedMap,
        mutation?: PersistenceMutation
    ) => Promise<void>;
    syncHistoryStatus: () => Promise<void>;
    showErrors: (errors: string[]) => void;
}

export class MapPersistenceCoordinator {
    private readonly options: MapPersistenceCoordinatorOptions;

    constructor(options: MapPersistenceCoordinatorOptions) {
        this.options = options;
    }

    async persist(options?: {
        throwOnFailure?: boolean;
        recordHistory?: boolean;
    }): Promise<boolean> {
        this.options.pruneDanglingGroupMembers();

        const beforeSnapshot = this.options.getLastSavedSnapshot();
        const afterSnapshot = this.options.buildSnapshot();
        const mutation = this.options.getMutation();

        try {
            await this.options.saveMap();

            const activeHistoryTitle = this.options.getActiveHistoryTitle();
            if (
                options?.recordHistory !== false &&
                !this.options.isHistorySuppressed() &&
                activeHistoryTitle &&
                beforeSnapshot &&
                !snapshotsEqualForHistory(beforeSnapshot, afterSnapshot)
            ) {
                await this.options.recordCheckpoint(
                    activeHistoryTitle,
                    beforeSnapshot,
                    afterSnapshot,
                    mutation
                );
                await this.options.syncHistoryStatus();
            }

            this.options.setLastSavedSnapshot(afterSnapshot);
            this.options.clearMutation();
            return true;
        } catch (error) {
            this.showSaveError(error);
            if (options?.throwOnFailure) {
                throw this.markSaveErrorAsShown(error);
            }

            return false;
        }
    }

    async save(): Promise<void> {
        await this.persist();
    }

    async saveOrThrow(): Promise<void> {
        await this.persist({ throwOnFailure: true });
    }

    private showSaveError(error: unknown): void {
        const errors = ['There was a problem saving the map:', this.getErrorMessage(error)];
        const errorStack = this.getErrorStack(error);
        if (errorStack) {
            errors.push(errorStack);
        }
        this.options.showErrors(errors);
    }

    private markSaveErrorAsShown(error: unknown): Error {
        const err = error instanceof Error ? error : new Error(this.getErrorMessage(error));
        (err as Error & { [SAVE_ERROR_ALREADY_SHOWN]?: boolean })[SAVE_ERROR_ALREADY_SHOWN] = true;
        return err;
    }

    private getErrorMessage(error: unknown): string {
        return String((error as { message?: unknown } | null | undefined)?.message ?? error);
    }

    private getErrorStack(error: unknown): string | null {
        const stack = (error as { stack?: unknown } | null | undefined)?.stack;
        return stack == null ? null : String(stack);
    }
}
