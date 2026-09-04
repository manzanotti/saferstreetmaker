import { snapshotForHistory, snapshotsEqualForHistory } from '../../services/history/mapSnapshot';
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

export interface PersistOptions {
    throwOnFailure?: boolean;
    recordHistory?: boolean;
    preserveMutation?: boolean;
    pruneDanglingGroupMembers?: boolean;
}

export class MapPersistenceCoordinator {
    private readonly options: MapPersistenceCoordinatorOptions;
    private persistenceQueue: Promise<void> | undefined;

    constructor(options: MapPersistenceCoordinatorOptions) {
        this.options = options;
    }

    async persist(options?: PersistOptions): Promise<boolean> {
        const queuedPersistence =
            this.persistenceQueue === undefined
                ? this.persistNow(options)
                : this.persistenceQueue.then(
                      () => this.persistNow(options),
                      () => this.persistNow(options)
                  );
        this.persistenceQueue = queuedPersistence.then(
            () => undefined,
            () => undefined
        );
        return await queuedPersistence;
    }

    async flush(): Promise<void> {
        await this.persistenceQueue;
    }

    private async persistNow(options?: PersistOptions): Promise<boolean> {
        if (options?.pruneDanglingGroupMembers !== false) {
            this.options.pruneDanglingGroupMembers();
        }

        const beforeSnapshot = this.options.getLastSavedSnapshot();
        const afterSnapshot = this.options.buildSnapshot();
        const mutation = this.options.getMutation();

        try {
            await this.options.saveMap();

            const activeHistoryTitle = this.options.getActiveHistoryTitle();
            const beforeHistorySnapshot = beforeSnapshot
                ? snapshotForHistory(beforeSnapshot)
                : null;
            const afterHistorySnapshot = snapshotForHistory(afterSnapshot);
            if (
                options?.recordHistory !== false &&
                !this.options.isHistorySuppressed() &&
                activeHistoryTitle &&
                beforeHistorySnapshot &&
                !snapshotsEqualForHistory(beforeHistorySnapshot, afterHistorySnapshot)
            ) {
                await this.options.recordCheckpoint(
                    activeHistoryTitle,
                    beforeHistorySnapshot,
                    afterHistorySnapshot,
                    mutation
                );
                await this.options.syncHistoryStatus();
            }

            this.options.setLastSavedSnapshot(afterSnapshot);
            if (options?.preserveMutation !== true) {
                this.options.clearMutation();
            }
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
