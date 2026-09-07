/**
 * Legacy localStorage → IndexedDB one-time migration helpers for MapStorage.
 * Extracted so the main MapStorage class stays focused on the current
 * IndexedDB persistence API.
 */
import type { SerializedMap } from './MapSerializer';

export const LEGACY_MAP_LIST_KEY = 'MapList';
export const LEGACY_LAST_SELECTED_KEY = 'LastMapSelected';
export const INDEXED_DB_MIGRATION_CUTOFF_VERSION = '0.9.0';

export function getLegacyStorage(): Storage | null | undefined {
    try {
        if (typeof localStorage === 'undefined') {
            return undefined;
        }
        return localStorage;
    } catch {
        return null;
    }
}

export function readLegacyMap(
    storage: Storage,
    mapName: string,
    decompress: (compressed: string) => string | null
): SerializedMap | null {
    const raw = storage.getItem(`Map_${mapName}`);
    if (raw === null || raw === 'undefined') {
        return null;
    }

    const decompressed = decompress(raw);
    if (!decompressed) {
        return null;
    }
    try {
        return JSON.parse(decompressed) as SerializedMap;
    } catch {
        return null;
    }
}

export function readLegacyMapList(
    storage: Storage,
    decompress: (compressed: string) => string | null
): string[] {
    const raw = storage.getItem(LEGACY_MAP_LIST_KEY);
    if (raw === null || raw === 'undefined') {
        return [];
    }

    const decompressed = decompress(raw);
    if (!decompressed) {
        return [];
    }
    try {
        return JSON.parse(decompressed) as string[];
    } catch {
        return [];
    }
}

export function readLegacyLastSelected(
    storage: Storage,
    decompress: (compressed: string) => string | null
): string {
    const raw = storage.getItem(LEGACY_LAST_SELECTED_KEY);
    if (raw === null || raw === 'undefined') {
        return '';
    }

    return decompress(raw) ?? '';
}

export function shouldImportLegacyMap(
    legacyMap: SerializedMap | null,
    compareVersions: (left: string, right: string) => number
): legacyMap is SerializedMap {
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

    return compareVersions(storedVersion, INDEXED_DB_MIGRATION_CUTOFF_VERSION) < 0;
}

export function compareVersions(left: string, right: string): number {
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
