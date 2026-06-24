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

export class MapDatabase extends Dexie {
    maps!: EntityTable<StoredMapRecord, 'title'>;
    metadata!: EntityTable<MetadataRecord, 'key'>;

    constructor() {
        super('SaferStreetMakerDB');

        this.version(1).stores({
            maps: 'title, sortOrder, updatedAt',
            metadata: 'key'
        });
    }
}
