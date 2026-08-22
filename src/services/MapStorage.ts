/**
 * MapStorage
 *
 * IndexedDB-backed persistence for saved maps.
 * A one-time import migrates existing localStorage map data on first use.
 */
import LZString from 'lz-string';
import type { IMapLayer } from '../composables/layers/IMapLayer';
import type { Settings } from '../models/Settings';
import type { Group } from '../models/Group';
import { MapDatabase, type StoredMapRecord } from './MapDatabase';
import { MapSerializer, type SerializedMap } from './MapSerializer';

const LEGACY_MAP_LIST_KEY = 'MapList';
const LEGACY_LAST_SELECTED_KEY = 'LastMapSelected';
const LAST_SELECTED_METADATA_KEY = 'lastSelectedMap';
const LEGACY_IMPORT_COMPLETED_METADATA_KEY = 'legacyImportCompleted';
const INDEXED_DB_MIGRATION_CUTOFF_VERSION = '0.9.0';

export class MapStorage {
    private readonly serializer: MapSerializer;
    private readonly db: MapDatabase;
    private readonly ready: Promise<void>;

    constructor(serializer: MapSerializer) {
        this.serializer = serializer;
        this.db = new MapDatabase();
        this.ready = this.initialise();
    }

    // ── Persistence ───────────────────────────────────────────────────────────

    /** Serialise the current map state into a compact payload, then persist it. */
    async saveMap(
        settings: Settings,
        layersData: Map<string, IMapLayer>,
        groups?: Group[]
    ): Promise<void> {
        await this.ready;

        const payload = this.serializer.toCompactStoredMap(settings, layersData, groups);

        await this.db.transaction('rw', this.db.maps, this.db.metadata, async () => {
            const sortOrder = await this.getNextSortOrder();

            await this.db.maps.put({
                title: settings.title,
                sortOrder,
                updatedAt: payload.d,
                payloadVersion: 1,
                payload
            });
            await this.db.metadata.put({
                key: LAST_SELECTED_METADATA_KEY,
                value: settings.title
            });
        });
    }

    /**
     * Load a stored map by title.
     * Returns `null` if no data is found for the given title.
     */
    async loadMap(mapName: string): Promise<SerializedMap | null> {
        await this.ready;

        const record = await this.db.maps.get(mapName);
        if (!record) {
            return null;
        }

        return this.serializer.fromCompactStoredMap(record.payload);
    }

    async loadRawMapRecord(mapName: string): Promise<StoredMapRecord | null> {
        await this.ready;

        return (await this.db.maps.get(mapName)) ?? null;
    }

    async deleteMap(mapName: string): Promise<void> {
        await this.ready;

        await this.db.transaction('rw', this.db.maps, this.db.metadata, async () => {
            await this.db.maps.delete(mapName);

            const lastSelected = await this.db.metadata.get(LAST_SELECTED_METADATA_KEY);
            if (lastSelected?.value === mapName) {
                const replacement = await this.db.maps.orderBy('sortOrder').reverse().first();
                if (replacement) {
                    await this.db.metadata.put({
                        key: LAST_SELECTED_METADATA_KEY,
                        value: replacement.title
                    });
                } else {
                    await this.db.metadata.delete(LAST_SELECTED_METADATA_KEY);
                }
            }
        });
    }

    /**
     * Copy the current map to a new title using the pattern `<title>_copy_N`
     * where N is the lowest integer not already taken.
     */
    async copyMap(
        settings: Settings,
        layersData: Map<string, IMapLayer>,
        groups?: Group[]
    ): Promise<void> {
        const existing = await this.listMaps();
        let index = 1;
        while (existing.includes(`${settings.title}_copy_${index}`)) {
            index++;
        }
        settings.title = `${settings.title}_copy_${index}`;
        await this.saveMap(settings, layersData, groups);
    }

    // ── Map list ──────────────────────────────────────────────────────────────

    /** Returns stored map titles in most-recently-saved order. */
    async listMaps(): Promise<string[]> {
        await this.ready;

        const maps = await this.db.maps.orderBy('sortOrder').reverse().toArray();
        return maps.map((map) => map.title);
    }

    async hasMap(mapName: string): Promise<boolean> {
        if (mapName === '') {
            return false;
        }

        await this.ready;
        return (await this.db.maps.get(mapName)) !== undefined;
    }

    // ── Last selected ─────────────────────────────────────────────────────────

    async saveLastMapSelected(mapName: string): Promise<void> {
        await this.ready;
        await this.db.metadata.put({ key: LAST_SELECTED_METADATA_KEY, value: mapName });
    }

    async loadLastSelected(): Promise<string> {
        await this.ready;

        const metadata = await this.db.metadata.get(LAST_SELECTED_METADATA_KEY);
        if (!metadata) {
            return '';
        }

        return metadata.value;
    }

    private async initialise(): Promise<void> {
        await this.importLegacyLocalStorage();
    }

    private async importLegacyLocalStorage(): Promise<void> {
        const migrationCompleted = await this.db.metadata.get(LEGACY_IMPORT_COMPLETED_METADATA_KEY);
        if (migrationCompleted?.value === '1') {
            return;
        }

        const legacyStorage = this.getLegacyStorage();
        if (legacyStorage === undefined) {
            await this.markLegacyImportCompleted();
            return;
        }
        if (legacyStorage === null) {
            return;
        }

        const mapCount = await this.db.maps.count();
        if (mapCount > 0) {
            await this.markLegacyImportCompleted();
            return;
        }

        let legacyList: string[];
        let legacyLastSelected: string;
        try {
            legacyList = this.readLegacyMapList(legacyStorage);
            legacyLastSelected = this.readLegacyLastSelected(legacyStorage);
        } catch {
            return;
        }
        if (legacyList.length === 0) {
            await this.markLegacyImportCompleted();
            return;
        }

        let legacyMaps: Array<{ mapName: string; map: SerializedMap }>;
        try {
            legacyMaps = legacyList.flatMap((mapName) => {
                const map = this.readLegacyMap(legacyStorage, mapName);
                return this.shouldImportLegacyMap(map) ? [{ mapName, map }] : [];
            });
        } catch {
            return;
        }

        const importedAt = Date.now();
        const importedMapNames: string[] = [];

        await this.db.transaction('rw', this.db.maps, this.db.metadata, async () => {
            for (let index = 0; index < legacyMaps.length; index++) {
                const { mapName, map: legacyMap } = legacyMaps[index];
                const payload = this.serializer.toCompactStoredMapFromSerialized(
                    legacyMap,
                    mapName
                );
                await this.db.maps.put({
                    title: mapName,
                    sortOrder: importedAt - index,
                    updatedAt: payload.d,
                    payloadVersion: 1,
                    payload
                });
                importedMapNames.push(mapName);
            }

            if (legacyLastSelected !== '' && importedMapNames.includes(legacyLastSelected)) {
                await this.db.metadata.put({
                    key: LAST_SELECTED_METADATA_KEY,
                    value: legacyLastSelected
                });
            }

            await this.db.metadata.put({
                key: LEGACY_IMPORT_COMPLETED_METADATA_KEY,
                value: '1'
            });
        });
    }

    private async markLegacyImportCompleted(): Promise<void> {
        await this.db.metadata.put({ key: LEGACY_IMPORT_COMPLETED_METADATA_KEY, value: '1' });
    }

    private getLegacyStorage(): Storage | null | undefined {
        try {
            if (typeof localStorage === 'undefined') {
                return undefined;
            }
            return localStorage;
        } catch {
            return null;
        }
    }

    private readLegacyMap(storage: Storage, mapName: string): SerializedMap | null {
        const raw = storage.getItem(`Map_${mapName}`);
        if (raw === null || raw === 'undefined') {
            return null;
        }

        const decompressed = LZString.decompress(raw);
        if (!decompressed) {
            return null;
        }
        try {
            return JSON.parse(decompressed) as SerializedMap;
        } catch {
            return null;
        }
    }

    private readLegacyMapList(storage: Storage): string[] {
        const raw = storage.getItem(LEGACY_MAP_LIST_KEY);
        if (raw === null || raw === 'undefined') {
            return [];
        }

        const decompressed = LZString.decompress(raw);
        if (!decompressed) {
            return [];
        }
        try {
            return JSON.parse(decompressed) as string[];
        } catch {
            return [];
        }
    }

    private readLegacyLastSelected(storage: Storage): string {
        const raw = storage.getItem(LEGACY_LAST_SELECTED_KEY);
        if (raw === null || raw === 'undefined') {
            return '';
        }

        return LZString.decompress(raw) ?? '';
    }

    private shouldImportLegacyMap(legacyMap: SerializedMap | null): legacyMap is SerializedMap {
        if (!legacyMap) {
            return false;
        }

        if (!legacyMap.settings) {
            return (
                legacyMap.title !== undefined ||
                legacyMap.layers !== undefined ||
                legacyMap.centre !== undefined ||
                legacyMap.zoom !== undefined
            );
        }

        const storedVersion = legacyMap.settings.version;
        if (storedVersion === undefined || storedVersion === '') {
            return true;
        }

        return this.compareVersions(storedVersion, INDEXED_DB_MIGRATION_CUTOFF_VERSION) < 0;
    }

    private compareVersions(left: string, right: string): number {
        const leftParts = left.split('.').map((part) => Number(part));
        const rightParts = right.split('.').map((part) => Number(part));
        const maxLength = Math.max(leftParts.length, rightParts.length);

        for (let index = 0; index < maxLength; index++) {
            const leftValue = leftParts[index] ?? 0;
            const rightValue = rightParts[index] ?? 0;

            if (leftValue !== rightValue) {
                return leftValue - rightValue;
            }
        }

        return 0;
    }

    private async getNextSortOrder(): Promise<number> {
        const latest = await this.db.maps.orderBy('sortOrder').last();
        return (latest?.sortOrder ?? 0) + 1;
    }
}
