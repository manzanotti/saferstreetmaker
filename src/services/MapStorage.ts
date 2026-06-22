/**
 * MapStorage
 *
 * All localStorage operations for the Safer Street Maker map data.
 * Uses LZ-string compression for every value it persists.
 *
 * Storage keys:
 *   Map_<title>     — compressed map JSON for each saved map
 *   MapList         — compressed JSON array of map titles (most-recent first)
 *   LastMapSelected — compressed string of the most recently loaded map title
 */
import LZString from 'lz-string';
import type { IMapLayer } from '../composables/layers/IMapLayer';
import type { Settings } from '../models/Settings';
import { MapSerializer, type SerializedMap } from './MapSerializer';

export class MapStorage {
    private readonly serializer: MapSerializer;

    constructor(serializer: MapSerializer) {
        this.serializer = serializer;
    }

    // ── Persistence ───────────────────────────────────────────────────────────

    /** Serialise and compress the current map state, then persist it. */
    saveMap(settings: Settings, layersData: Map<string, IMapLayer>): void {
        const mapString = JSON.stringify(this.serializer.toJSON(settings, layersData));
        localStorage.setItem(`Map_${settings.title}`, LZString.compress(mapString));
        this.saveMapList(settings.title);
        this.saveLastMapSelected(settings.title);
    }

    /**
     * Load and decompress a stored map by title.
     * Returns `null` if no data is found for the given title.
     */
    loadMap(mapName: string): SerializedMap | null {
        const raw = localStorage.getItem(`Map_${mapName}`);
        if (raw === null || raw === 'undefined') {
            return null;
        }
        const decompressed = LZString.decompress(raw);
        return decompressed ? (JSON.parse(decompressed) as SerializedMap) : null;
    }

    deleteMap(mapName: string): void {
        localStorage.removeItem(`Map_${mapName}`);

        const remaining = this.listMaps().filter((t) => t !== mapName);
        localStorage.setItem('MapList', LZString.compress(JSON.stringify(remaining)));

        if (this.loadLastSelected() === mapName) {
            if (remaining.length > 0) {
                this.saveLastMapSelected(remaining[0]);
            } else {
                localStorage.removeItem('LastMapSelected');
            }
        }
    }

    /**
     * Copy the current map to a new title using the pattern `<title>_copy_N`
     * where N is the lowest integer not already taken.
     */
    copyMap(settings: Settings, layersData: Map<string, IMapLayer>): void {
        const existing = this.listMaps();
        let index = 1;
        while (existing.includes(`${settings.title}_copy_${index}`)) {
            index++;
        }
        settings.title = `${settings.title}_copy_${index}`;
        this.saveMap(settings, layersData);
    }

    // ── Map list ──────────────────────────────────────────────────────────────

    /** Returns stored map titles in most-recently-saved order. */
    listMaps(): string[] {
        const raw = localStorage.getItem('MapList');
        if (raw === null || raw === 'undefined') {
            return [];
        }
        const decompressed = LZString.decompress(raw);
        return decompressed ? JSON.parse(decompressed) : [];
    }

    hasMap(mapName: string): boolean {
        if (mapName === '') {
            return false;
        }

        const raw = localStorage.getItem(`Map_${mapName}`);
        return raw !== null && raw !== 'undefined';
    }

    saveMapList(mapTitle: string): void {
        const list = this.listMaps().filter((t) => t !== mapTitle);
        list.unshift(mapTitle);
        localStorage.setItem('MapList', LZString.compress(JSON.stringify(list)));
    }

    // ── Last selected ─────────────────────────────────────────────────────────

    saveLastMapSelected(mapName: string): void {
        localStorage.setItem('LastMapSelected', LZString.compress(mapName));
    }

    loadLastSelected(): string {
        const raw = localStorage.getItem('LastMapSelected');
        if (raw === null || raw === 'undefined') {
            return '';
        }
        return LZString.decompress(raw) ?? '';
    }
}
