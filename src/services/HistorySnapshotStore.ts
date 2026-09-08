import type { HistoryImportedLayersRecord } from './MapDatabase';
import type { SerializedMap } from './MapSerializer';

export type StoredHistorySnapshot = Omit<SerializedMap, 'importedLayers'> & {
    importedLayersRef?: string;
};

export interface StoredHistorySnapshotResult {
    snapshot: StoredHistorySnapshot;
    importedLayersRecord?: HistoryImportedLayersRecord;
}

export class HistorySnapshotStore {
    public storeImportedLayersReference(snapshot: SerializedMap): StoredHistorySnapshotResult {
        if (!snapshot.importedLayers || snapshot.importedLayers.length === 0) {
            return { snapshot };
        }

        const serialized = JSON.stringify(snapshot.importedLayers);
        const id = `v1-${hashString(serialized)}-${serialized.length}`;
        const { importedLayers: _importedLayers, ...snapshotWithoutImportedLayers } = snapshot;
        return {
            snapshot: { ...snapshotWithoutImportedLayers, importedLayersRef: id },
            importedLayersRecord: {
                id,
                importedLayers: snapshot.importedLayers
            }
        };
    }

    public async resolveSnapshot(
        db: Pick<HistorySnapshotDatabase, 'historyImportedLayers'>,
        value: unknown
    ): Promise<SerializedMap> {
        if (!value || typeof value !== 'object') {
            return value as SerializedMap;
        }

        const stored = value as StoredHistorySnapshot;
        if (!stored.importedLayersRef) {
            return stored as SerializedMap;
        }

        const importedLayersRecord = await db.historyImportedLayers.get(stored.importedLayersRef);
        const { importedLayersRef: _importedLayersRef, ...snapshot } = stored;
        return {
            ...snapshot,
            importedLayers: importedLayersRecord?.importedLayers ?? []
        };
    }
}

interface HistorySnapshotDatabase {
    historyImportedLayers: {
        get(id: string): Promise<HistoryImportedLayersRecord | undefined>;
    };
}

function hashString(value: string): string {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}
