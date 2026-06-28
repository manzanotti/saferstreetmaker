import { MapDatabase } from './MapDatabase';
import type { HistoryEntryRecord } from './MapDatabase';
import type { SerializedMap } from './MapSerializer';

export interface HistoryStatus {
    canUndo: boolean;
    canRedo: boolean;
}

export interface HistoryReplayEntry {
    direction: 'undo' | 'redo';
    entry: HistoryEntryRecord;
    snapshot: SerializedMap;
}

export class UndoJournal {
    private readonly db: MapDatabase;

    /** Maximum number of history entries kept per map. Oldest entries beyond
     * this limit are pruned after each checkpoint write. */
    static readonly MAX_HISTORY = 300;

    constructor() {
        this.db = new MapDatabase();
    }

    async clearHistory(mapTitle: string): Promise<void> {
        await this.db.transaction('rw', this.db.historyEntries, this.db.historyStates, async () => {
            // Use primaryKeys() to avoid fetching full row objects unnecessarily.
            const ids = await this.db.historyEntries
                .where('mapTitle')
                .equals(mapTitle)
                .primaryKeys();
            if (ids.length > 0) {
                await this.db.historyEntries.bulkDelete(ids as number[]);
            }

            await this.db.historyStates.put({ mapTitle, currentSequence: 0 });
        });
    }

    async renameHistory(fromMapTitle: string, toMapTitle: string): Promise<void> {
        if (fromMapTitle === toMapTitle) {
            return;
        }

        await this.db.transaction('rw', this.db.historyEntries, this.db.historyStates, async () => {
            const [entries, state] = await Promise.all([
                this.db.historyEntries.where('mapTitle').equals(fromMapTitle).toArray(),
                this.db.historyStates.get(fromMapTitle)
            ]);

            if (entries.length > 0) {
                await this.db.historyEntries.bulkPut(
                    entries.map((entry) => ({
                        ...entry,
                        mapTitle: toMapTitle
                    }))
                );
            }

            if (state) {
                await this.db.historyStates.put({
                    mapTitle: toMapTitle,
                    currentSequence: state.currentSequence
                });
                await this.db.historyStates.delete(fromMapTitle);
            }
        });
    }

    async getStatus(mapTitle: string): Promise<HistoryStatus> {
        const [maxEntry, minEntry, state] = await Promise.all([
            // Use the compound index to find the highest sequence in O(1).
            this.db.historyEntries
                .where('[mapTitle+sequence]')
                .between([mapTitle, -Infinity], [mapTitle, Infinity])
                .last(),
            // Use the compound index to find the lowest surviving sequence in O(1).
            this.db.historyEntries
                .where('[mapTitle+sequence]')
                .between([mapTitle, -Infinity], [mapTitle, Infinity])
                .first(),
            this.db.historyStates.get(mapTitle)
        ]);

        const maxSequence = maxEntry?.sequence ?? -1;
        const minSequence = minEntry?.sequence ?? 0;
        const nextSequence = state?.currentSequence ?? 0;

        return {
            // canUndo requires at least one surviving entry below the current
            // position. After cap-pruning, minSequence > 0, so this correctly
            // disables undo once the oldest surviving entry is reached.
            canUndo: nextSequence > minSequence,
            canRedo: nextSequence <= maxSequence
        };
    }

    async recordCheckpoint(
        mapTitle: string,
        before: SerializedMap,
        after: SerializedMap,
        kind = 'checkpoint',
        mutation?: {
            kind: string;
            layerId: string;
            payload?: unknown;
        }
    ): Promise<void> {
        await this.db.transaction('rw', this.db.historyEntries, this.db.historyStates, async () => {
            const state = await this.db.historyStates.get(mapTitle);
            const nextSequence = state?.currentSequence ?? 0;

            // Delete any redo entries (sequence >= current position) using the
            // compound index so we avoid an O(n) full scan.
            const redoEntryIds = await this.db.historyEntries
                .where('[mapTitle+sequence]')
                .between([mapTitle, nextSequence], [mapTitle, Infinity], true, true)
                .primaryKeys();
            if (redoEntryIds.length > 0) {
                await this.db.historyEntries.bulkDelete(redoEntryIds as number[]);
            }

            await this.db.historyEntries.add({
                mapTitle,
                sequence: nextSequence,
                kind,
                mutationKind: mutation?.kind,
                mutationLayerId: mutation?.layerId,
                mutationPayload: mutation?.payload,
                before,
                after,
                createdAt: new Date().toISOString()
            });

            const newSequence = nextSequence + 1;
            await this.db.historyStates.put({ mapTitle, currentSequence: newSequence });

            // Prune oldest entries if the history cap is exceeded.
            // Sort by sequence ascending (via compound index) so we always delete
            // the logically oldest entries, not just those with the lowest primary key.
            const allEntries = await this.db.historyEntries
                .where('[mapTitle+sequence]')
                .between([mapTitle, -Infinity], [mapTitle, Infinity])
                .toArray();
            if (allEntries.length > UndoJournal.MAX_HISTORY) {
                const overflow = allEntries.length - UndoJournal.MAX_HISTORY;
                // allEntries is already sorted by sequence ascending from the index.
                const idsToRemove = allEntries
                    .slice(0, overflow)
                    .map((e) => e.id)
                    .filter((id): id is number => id !== undefined);
                if (idsToRemove.length > 0) {
                    await this.db.historyEntries.bulkDelete(idsToRemove);
                }
                // Note: currentSequence is intentionally left at newSequence.
                // undoEntry self-heals when it finds that entries below currentSequence
                // have been pruned by snapping to the oldest surviving sequence.
            }
        });
    }

    async undo(mapTitle: string): Promise<SerializedMap | null> {
        const replay = await this.undoEntry(mapTitle);
        return replay?.snapshot ?? null;
    }

    async undoEntry(mapTitle: string): Promise<HistoryReplayEntry | null> {
        return await this.db.transaction(
            'rw',
            this.db.historyEntries,
            this.db.historyStates,
            async () => {
                const state = await this.db.historyStates.get(mapTitle);
                const nextSequence = state?.currentSequence ?? 0;
                const targetSequence = nextSequence - 1;
                if (targetSequence < 0) {
                    return null;
                }

                const entry = await this.db.historyEntries
                    .where('[mapTitle+sequence]')
                    .equals([mapTitle, targetSequence])
                    .first();

                if (!entry) {
                    // The entry at targetSequence was pruned (cap exceeded).
                    // Find the actual oldest surviving entry and snap currentSequence
                    // to it so future undo calls are consistent.
                    const oldest = await this.db.historyEntries
                        .where('[mapTitle+sequence]')
                        .between([mapTitle, -Infinity], [mapTitle, Infinity])
                        .first();
                    if (!oldest) {
                        await this.db.historyStates.put({ mapTitle, currentSequence: 0 });
                        return null;
                    }
                    await this.db.historyStates.put({
                        mapTitle,
                        currentSequence: oldest.sequence
                    });
                    return null;
                }

                await this.db.historyStates.put({
                    mapTitle,
                    currentSequence: targetSequence
                });

                return {
                    direction: 'undo',
                    entry,
                    snapshot: entry.before as SerializedMap
                };
            }
        );
    }

    async redo(mapTitle: string): Promise<SerializedMap | null> {
        const replay = await this.redoEntry(mapTitle);
        return replay?.snapshot ?? null;
    }

    async redoEntry(mapTitle: string): Promise<HistoryReplayEntry | null> {
        return await this.db.transaction(
            'rw',
            this.db.historyEntries,
            this.db.historyStates,
            async () => {
                const state = await this.db.historyStates.get(mapTitle);
                const nextSequence = state?.currentSequence ?? 0;

                const entry = await this.db.historyEntries
                    .where('[mapTitle+sequence]')
                    .equals([mapTitle, nextSequence])
                    .first();
                if (!entry) {
                    return null;
                }

                await this.db.historyStates.put({ mapTitle, currentSequence: nextSequence + 1 });

                return {
                    direction: 'redo',
                    entry,
                    snapshot: entry.after as SerializedMap
                };
            }
        );
    }

    async getLatestEntry(mapTitle: string): Promise<HistoryEntryRecord | null> {
        return (
            (await this.db.historyEntries
                .where('[mapTitle+sequence]')
                .between([mapTitle, -Infinity], [mapTitle, Infinity])
                .last()) ?? null
        );
    }
}
