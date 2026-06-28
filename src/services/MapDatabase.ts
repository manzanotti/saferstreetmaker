import Dexie, { type EntityTable } from 'dexie';
import type { CompactStoredMap } from './MapSerializer';

export interface StoredMapRecord {
    title: string;
    sortOrder: number;
    updatedAt: string;
    payloadVersion: number;
    payload: CompactStoredMap;
}

export interface MetadataRecord {
    key: string;
    value: string;
}

export interface HistoryEntryRecord {
    id?: number;
    mapTitle: string;
    sequence: number;
    kind: string;
    mutationKind?: string;
    mutationLayerId?: string;
    mutationPayload?: unknown;
    before: unknown;
    after: unknown;
    createdAt: string;
}

export interface HistoryStateRecord {
    mapTitle: string;
    currentSequence: number;
}

export class MapDatabase extends Dexie {
    maps!: EntityTable<StoredMapRecord, 'title'>;
    metadata!: EntityTable<MetadataRecord, 'key'>;
    historyEntries!: EntityTable<HistoryEntryRecord, 'id'>;
    historyStates!: EntityTable<HistoryStateRecord, 'mapTitle'>;

    constructor() {
        super('SaferStreetMakerDB');

        this.version(1).stores({
            maps: 'title, sortOrder, updatedAt',
            metadata: 'key'
        });

        this.version(2).stores({
            maps: 'title, sortOrder, updatedAt',
            metadata: 'key',
            historyEntries: '++id, mapTitle, sequence, [mapTitle+sequence], createdAt',
            historyStates: 'mapTitle'
        });
    }
}
