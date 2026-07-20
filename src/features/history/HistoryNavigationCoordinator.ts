import type { HistoryReplayEntry, UndoJournal } from '../../services/UndoJournal';

export interface HistoryNavigationCoordinatorOptions {
    undoJournal: Pick<UndoJournal, 'undoEntry' | 'redoEntry'>;
    getActiveHistoryTitle: () => string | null;
    applyReplay: (replay: HistoryReplayEntry) => Promise<boolean>;
    revealMutationArea: (payload: unknown) => void;
    syncHistoryStatus: () => Promise<void>;
}

export class HistoryNavigationCoordinator {
    private readonly options: HistoryNavigationCoordinatorOptions;

    constructor(options: HistoryNavigationCoordinatorOptions) {
        this.options = options;
    }

    async undo(): Promise<boolean> {
        return await this.navigate('undo');
    }

    async redo(): Promise<boolean> {
        return await this.navigate('redo');
    }

    private async navigate(direction: 'undo' | 'redo'): Promise<boolean> {
        const mapTitle = this.options.getActiveHistoryTitle();
        if (!mapTitle) {
            return false;
        }

        const replay = await this.options.undoJournal[`${direction}Entry`](mapTitle);
        if (!replay) {
            await this.options.syncHistoryStatus();
            return false;
        }

        const applied = await this.options.applyReplay(replay);
        if (applied) {
            this.options.revealMutationArea(replay.entry.mutationPayload);
        }
        await this.options.syncHistoryStatus();
        return applied;
    }
}
