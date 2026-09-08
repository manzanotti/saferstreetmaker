import LZString from 'lz-string';
import type { MapDatabase } from './MapDatabase';
import type { MapSerializer, SerializedMap } from './MapSerializer';

const LEGACY_MAP_LIST_KEY = 'MapList';
const LEGACY_LAST_SELECTED_KEY = 'LastMapSelected';
const LAST_SELECTED_METADATA_KEY = 'lastSelectedMap';
const LEGACY_IMPORT_COMPLETED_METADATA_KEY = 'legacyImportCompleted';
const INDEXED_DB_MIGRATION_CUTOFF_VERSION = '0.9.0';

export class LegacyMapStorageImporter {
    public constructor(
        private readonly db: MapDatabase,
        private readonly serializer: MapSerializer
    ) {}

    public async import(): Promise<void> {
        const migrationCompleted = await this.db.metadata.get(LEGACY_IMPORT_COMPLETED_METADATA_KEY);
        if (migrationCompleted?.value === '1') {
            return;
        }

        const legacyStorage = this.getLegacyStorage();
        if (legacyStorage === undefined) {
            await this.markImportCompleted();
            return;
        }
        if (legacyStorage === null) {
            return;
        }

        const mapCount = await this.db.maps.count();
        if (mapCount > 0) {
            await this.markImportCompleted();
            return;
        }

        let legacyList: string[];
        let legacyLastSelected: string;
        try {
            legacyList = this.readMapList(legacyStorage);
            legacyLastSelected = this.readLastSelected(legacyStorage);
        } catch {
            return;
        }
        if (legacyList.length === 0) {
            await this.markImportCompleted();
            return;
        }

        let legacyMaps: Array<{ mapName: string; map: SerializedMap }>;
        try {
            legacyMaps = legacyList.flatMap((mapName) => {
                const map = this.readMap(legacyStorage, mapName);
                return this.shouldImport(map) ? [{ mapName, map }] : [];
            });
        } catch {
            return;
        }

        const importedAt = Date.now();
        const importedMapNames: string[] = [];

        await this.db.transaction('rw', this.db.maps, this.db.metadata, async () => {
            for (let index = 0; index < legacyMaps.length; index++) {
                const { mapName, map } = legacyMaps[index];
                const payload = this.serializer.toCompactStoredMapFromSerialized(map, mapName);
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

    private async markImportCompleted(): Promise<void> {
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

    private readMap(storage: Storage, mapName: string): SerializedMap | null {
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

    private readMapList(storage: Storage): string[] {
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

    private readLastSelected(storage: Storage): string {
        const raw = storage.getItem(LEGACY_LAST_SELECTED_KEY);
        if (raw === null || raw === 'undefined') {
            return '';
        }

        return LZString.decompress(raw) ?? '';
    }

    private shouldImport(legacyMap: SerializedMap | null): legacyMap is SerializedMap {
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
}
