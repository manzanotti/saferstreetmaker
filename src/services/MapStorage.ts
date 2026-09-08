/**
 * MapStorage
 *
 * IndexedDB-backed persistence for saved maps.
 * A one-time import migrates existing localStorage map data on first use.
 */
import type { IMapLayer } from '../composables/layers/IMapLayer';
import type { Settings } from '../models/Settings';
import type { Group } from '../models/Group';
import type { ImportedGeoJsonLayer } from '../models/ImportedGeoJsonLayer';
import { MapDatabase, type StoredMapRecord } from './MapDatabase';
import { MapSerializer, type SerializedMap } from './MapSerializer';
import { LegacyMapStorageImporter } from './legacyMapStorageImport';

const LAST_SELECTED_METADATA_KEY = 'lastSelectedMap';

export class MapStorage {
    private readonly serializer: MapSerializer;
    private readonly db: MapDatabase;
    private readonly ready: Promise<void>;
    private writeQueue: Promise<void> = Promise.resolve();
    private readonly legacyImporter: LegacyMapStorageImporter;

    constructor(serializer: MapSerializer) {
        this.serializer = serializer;
        this.db = new MapDatabase();
        this.legacyImporter = new LegacyMapStorageImporter(this.db, this.serializer);
        this.ready = this.initialise();
    }

    // ── Persistence ───────────────────────────────────────────────────────────

    /** Serialise the current map state into a compact payload, then persist it. */
    async saveMap(
        settings: Settings,
        layersData: Map<string, IMapLayer>,
        groups?: Group[],
        importedLayers?: ImportedGeoJsonLayer[]
    ): Promise<void> {
        await this.enqueueWrite(() =>
            this.saveMapNow(settings, layersData, groups, importedLayers)
        );
    }

    private async saveMapNow(
        settings: Settings,
        layersData: Map<string, IMapLayer>,
        groups?: Group[],
        importedLayers?: ImportedGeoJsonLayer[]
    ): Promise<void> {
        await this.ready;

        const payload = this.serializer.toCompactStoredMap(
            settings,
            layersData,
            groups,
            importedLayers
        );

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
        await this.enqueueWrite(async () => {
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
        });
    }

    async copyMap(
        settings: Settings,
        layersData: Map<string, IMapLayer>,
        groups?: Group[],
        importedLayers?: ImportedGeoJsonLayer[]
    ): Promise<void> {
        await this.enqueueWrite(async () => {
            const existing = await this.listMaps();
            let index = 1;
            while (existing.includes(`${settings.title}_copy_${index}`)) {
                index++;
            }
            settings.title = `${settings.title}_copy_${index}`;
            await this.saveMapNow(settings, layersData, groups, importedLayers);
        });
    }

    private async enqueueWrite<T>(operation: () => Promise<T>): Promise<T> {
        const queuedOperation = this.writeQueue.then(operation, operation);
        this.writeQueue = queuedOperation.then(
            () => undefined,
            () => undefined
        );
        return await queuedOperation;
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
        await this.enqueueWrite(async () => {
            await this.ready;
            await this.db.metadata.put({ key: LAST_SELECTED_METADATA_KEY, value: mapName });
        });
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
        await this.legacyImporter.import();
    }

    private async getNextSortOrder(): Promise<number> {
        const latest = await this.db.maps.orderBy('sortOrder').last();
        return (latest?.sortOrder ?? 0) + 1;
    }
}
