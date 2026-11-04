import type { MapDatabase } from './MapDatabase';
import type { SerializedMap } from './MapSerializer';
import type { HistorySnapshotStore } from './HistorySnapshotStore';

export interface HistoryMutation {
    kind: string;
    layerId: string;
    payload?: unknown;
}

export async function recordHistoryCheckpoint(
    db: MapDatabase,
    snapshotStore: HistorySnapshotStore,
    maxHistory: number,
    mapTitle: string,
    before: SerializedMap,
    after: SerializedMap,
    kind: string,
    mutation?: HistoryMutation
): Promise<void> {
    const [storedBefore, storedAfter] = await Promise.all([
        snapshotStore.storeImportedLayersReference(before),
        snapshotStore.storeImportedLayersReference(after)
    ]);
    await db.transaction(
        'rw',
        db.historyEntries,
        db.historyStates,
        db.historyImportedLayers,
        async () => {
            for (const storedSnapshot of [storedBefore, storedAfter]) {
                if (storedSnapshot.importedLayersRecord) {
                    await db.historyImportedLayers.put(storedSnapshot.importedLayersRecord);
                }
            }
            const state = await db.historyStates.get(mapTitle);
            const nextSequence = state?.currentSequence ?? 0;

            const redoEntryIds = await db.historyEntries
                .where('[mapTitle+sequence]')
                .between([mapTitle, nextSequence], [mapTitle, Infinity], true, true)
                .primaryKeys();
            if (redoEntryIds.length > 0) {
                await db.historyEntries.bulkDelete(redoEntryIds as number[]);
            }

            await db.historyEntries.add({
                mapTitle,
                sequence: nextSequence,
                kind,
                mutationKind: mutation?.kind,
                mutationLayerId: mutation?.layerId,
                mutationPayload: mutation?.payload,
                before: storedBefore.snapshot,
                after: storedAfter.snapshot,
                createdAt: new Date().toISOString()
            });

            const newSequence = nextSequence + 1;
            await db.historyStates.put({ mapTitle, currentSequence: newSequence });

            const entryCount = await db.historyEntries
                .where('[mapTitle+sequence]')
                .between([mapTitle, -Infinity], [mapTitle, Infinity])
                .count();
            if (entryCount > maxHistory) {
                const overflow = entryCount - maxHistory;
                const idsToRemove = (await db.historyEntries
                    .where('[mapTitle+sequence]')
                    .between([mapTitle, -Infinity], [mapTitle, Infinity])
                    .limit(overflow)
                    .primaryKeys()) as number[];
                if (idsToRemove.length > 0) {
                    await db.historyEntries.bulkDelete(idsToRemove);
                }
            }
        }
    );
}
