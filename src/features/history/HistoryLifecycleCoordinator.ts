import { snapshotsEqualForHistory } from '../../services/history/mapSnapshot';
import type { SerializedMap } from '../../services/MapSerializer';
import { UndoJournal } from '../../services/UndoJournal';

export interface HistoryLifecycleCoordinatorOptions {
    historyStore: {
        clearStatus: () => void;
        setStatus: (status: { canUndo: boolean; canRedo: boolean }) => void;
    };
    undoJournal: Pick<
        UndoJournal,
        'clearHistory' | 'getStatus' | 'migrateRemoveViewOnlyCheckpoints'
    >;
    buildSnapshot: () => SerializedMap;
    setLastSavedSnapshot: (snapshot: SerializedMap) => void;
    loadMapListFromStorage: () => Promise<string[]>;
}

export class HistoryLifecycleCoordinator {
    private readonly options: HistoryLifecycleCoordinatorOptions;
    private activeHistoryMapTitle: string | null = null;

    constructor(options: HistoryLifecycleCoordinatorOptions) {
        this.options = options;
    }

    getActiveHistoryTitle(): string | null {
        return this.activeHistoryMapTitle;
    }

    async activate(mapTitle: string, options?: { reset?: boolean }): Promise<void> {
        this.activeHistoryMapTitle = mapTitle;
        if (options?.reset) {
            await this.options.undoJournal.clearHistory(mapTitle);
            this.options.setLastSavedSnapshot(this.options.buildSnapshot());
            this.options.historyStore.clearStatus();
        }
        void this.syncStatus();
    }

    async syncStatus(): Promise<void> {
        if (!this.activeHistoryMapTitle) {
            this.options.historyStore.clearStatus();
            return;
        }

        this.options.historyStore.setStatus(
            await this.options.undoJournal.getStatus(this.activeHistoryMapTitle)
        );
    }

    async migrateViewOnlyCheckpoints(): Promise<void> {
        try {
            const titles = new Set(await this.options.loadMapListFromStorage());
            if (this.activeHistoryMapTitle) {
                titles.add(this.activeHistoryMapTitle);
            }
            await this.options.undoJournal.migrateRemoveViewOnlyCheckpoints(
                [...titles],
                (before, after) =>
                    snapshotsEqualForHistory(before as SerializedMap, after as SerializedMap)
            );
            await this.syncStatus();
        } catch {
            // Best-effort cleanup — never block map loading on a migration error.
        }
    }
}
