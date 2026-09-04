import Dexie, { type EntityTable } from 'dexie';
import type { CompactStoredMap } from './MapSerializer';
import type { SerializedImportedGeoJsonLayer } from '../models/ImportedGeoJsonLayer';

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

export interface HistoryImportedLayersRecord {
    id: string;
    importedLayers: SerializedImportedGeoJsonLayer[];
}

export class MapDatabase extends Dexie {
    maps!: EntityTable<StoredMapRecord, 'title'>;
    metadata!: EntityTable<MetadataRecord, 'key'>;
    historyEntries!: EntityTable<HistoryEntryRecord, 'id'>;
    historyStates!: EntityTable<HistoryStateRecord, 'mapTitle'>;
    historyImportedLayers!: EntityTable<HistoryImportedLayersRecord, 'id'>;

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

        this.version(3).stores({
            maps: 'title, sortOrder, updatedAt',
            metadata: 'key',
            historyEntries: '++id, mapTitle, sequence, [mapTitle+sequence], createdAt',
            historyStates: 'mapTitle',
            historyImportedLayers: 'id'
        });
    }
}
