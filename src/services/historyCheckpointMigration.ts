import type { HistoryEntryRecord, MapDatabase } from './MapDatabase';

export const VIEW_CHECKPOINT_MIGRATION_KEY = 'historyViewCheckpointMigration:v1';

export async function pruneNoOpCheckpoints(
    db: MapDatabase,
    mapTitle: string,
    isNoOp: (before: unknown, after: unknown) => boolean
): Promise<number> {
    return await db.transaction('rw', db.historyEntries, db.historyStates, async () => {
        const entries = await db.historyEntries
            .where('[mapTitle+sequence]')
            .between([mapTitle, -Infinity], [mapTitle, Infinity])
            .sortBy('sequence');
        if (entries.length === 0) {
            return 0;
        }

        const state = await db.historyStates.get(mapTitle);
        const currentSequence = state?.currentSequence ?? 0;
        const minSequence = entries[0].sequence;

        const survivors: HistoryEntryRecord[] = [];
        let removedCount = 0;
        let removedBeforeCurrent = 0;
        for (const entry of entries) {
            if (isNoOp(entry.before, entry.after)) {
                removedCount++;
                if (entry.sequence < currentSequence) {
                    removedBeforeCurrent++;
                }
                continue;
            }
            survivors.push(entry);
        }

        if (removedCount === 0) {
            return 0;
        }

        const idsToDelete = entries
            .map((entry) => entry.id)
            .filter((id): id is number => id != null);
        await db.historyEntries.bulkDelete(idsToDelete);

        if (survivors.length > 0) {
            const renumbered = survivors.map((entry, index) => {
                const { id: _id, ...rest } = entry;
                return { ...rest, sequence: index };
            });
            await db.historyEntries.bulkAdd(renumbered);
        }

        const newCurrentSequence = Math.min(
            survivors.length,
            Math.max(0, currentSequence - minSequence - removedBeforeCurrent)
        );
        await db.historyStates.put({
            mapTitle,
            currentSequence: newCurrentSequence
        });

        return removedCount;
    });
}

export async function migrateViewOnlyCheckpoints(
    db: MapDatabase,
    mapTitles: string[],
    isNoOp: (before: unknown, after: unknown) => boolean
): Promise<void> {
    const flag = await db.metadata.get(VIEW_CHECKPOINT_MIGRATION_KEY);
    if (flag?.value === '1') {
        return;
    }

    for (const mapTitle of mapTitles) {
        await pruneNoOpCheckpoints(db, mapTitle, isNoOp);
    }

    await db.metadata.put({
        key: VIEW_CHECKPOINT_MIGRATION_KEY,
        value: '1'
    });
}
