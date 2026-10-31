/**
 * Shared FileManager and serialized-map fixtures for the loadMapData unit tests.
 */
import { vi } from 'vitest';
import { FileManager } from '../../../src/services/FileManager';
import type { SerializedMap } from '../../../src/services/MapSerializer';

// ---------------------------------------------------------------------------

export function makeFileManager(): FileManager {
    const fm = new FileManager();
    vi.spyOn(fm, 'saveMap').mockImplementation(() => {});
    return fm;
}

export function makeSerializedMap(overrides: Partial<SerializedMap> = {}): SerializedMap {
    return {
        settings: {
            title: 'Test Map',
            readOnly: false,
            hideToolbar: false,
            activeLayers: [],
            centre: { lat: 51.5, lng: -0.1 }, // London
            zoom: 12,
            version: '0.8.1'
        },
        layers: {},
        ...overrides
    };
}
