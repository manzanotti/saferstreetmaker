/**
 * Tests for loadMapData in useMapManager — specifically verifying that the
 * URL-parameter centre/zoom overrides are applied correctly and are not broken
 * by the former `centre` variable shadowing inside the function.
 */
import { describe, it, expect, beforeAll, beforeEach, vi, afterEach } from 'vitest';
import { setActivePinia } from 'pinia';

vi.mock('leaflet', () => import('../__mocks__/leaflet'));

import * as L from 'leaflet';
import { pinia } from '../../../src/stores/index';
import { useMapStore } from '../../../src/stores/mapStore';
import { useSettingsStore } from '../../../src/stores/settingsStore';
import { setupMapManager } from '../../../src/composables/useMapManager';
import { FileManager } from '../../../src/services/FileManager';
import type { SerializedMap } from '../../../src/services/MapSerializer';

// ---------------------------------------------------------------------------

function makeFileManager(): FileManager {
    const fm = new FileManager();
    vi.spyOn(fm, 'saveMap').mockImplementation(() => {});
    return fm;
}

function makeSerializedMap(overrides: Partial<SerializedMap> = {}): SerializedMap {
    return {
        settings: {
            title: 'Test Map',
            readOnly: false,
            hideToolbar: false,
            activeLayers: [],
            centre: { lat: 51.5, lng: -0.1 }, // London
            zoom: 12,
            version: '0.8.1',
        },
        layers: {},
        ...overrides,
    };
}

// ---------------------------------------------------------------------------

describe('useMapManager – URL param overrides in loadMapData', () => {
    let fm: FileManager;
    let mapManager: ReturnType<typeof setupMapManager>;

    beforeAll(() => {
        setActivePinia(pinia);
        fm = makeFileManager();

        const mapStore = useMapStore(pinia);
        mapStore.setMap(new L.Map() as unknown as L.Map);

        // setupMapManager registers watchers, so initialise once per suite.
        mapManager = setupMapManager(fm);
    });

    beforeEach(() => {
        setActivePinia(pinia);
        vi.useFakeTimers();

        vi.spyOn(fm, 'saveMap').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('applies the centre stored in settings when no URL centre is provided', async () => {
        vi.spyOn(fm, 'loadMapFromStorage').mockReturnValue(makeSerializedMap());
        vi.spyOn(fm, 'loadLastMapSelected').mockReturnValue('Test Map');

        await mapManager.loadMap(null, '', false, null, null);

        const settingsStore = useSettingsStore(pinia);
        expect(settingsStore.centre?.lat).toBeCloseTo(51.5);
        expect(settingsStore.centre?.lng).toBeCloseTo(-0.1);
        expect(settingsStore.zoom).toBe(12);
    });

    it('overrides stored centre with the URL centre parameter', async () => {
        vi.spyOn(fm, 'loadMapFromStorage').mockReturnValue(makeSerializedMap());
        vi.spyOn(fm, 'loadLastMapSelected').mockReturnValue('Test Map');

        // URL param: Birmingham
        await mapManager.loadMap(null, '', false, null, [52.5, -1.9]);

        const settingsStore = useSettingsStore(pinia);
        // Should be Birmingham, not London
        expect(settingsStore.centre?.lat).toBeCloseTo(52.5);
        expect(settingsStore.centre?.lng).toBeCloseTo(-1.9);
    });

    it('overrides stored zoom with the URL zoom parameter', async () => {
        vi.spyOn(fm, 'loadMapFromStorage').mockReturnValue(makeSerializedMap());
        vi.spyOn(fm, 'loadLastMapSelected').mockReturnValue('Test Map');

        await mapManager.loadMap(null, '', false, '17', null);

        const settingsStore = useSettingsStore(pinia);
        expect(settingsStore.zoom).toBe(17);
    });

    it('applies both URL centre and zoom overrides simultaneously', async () => {
        vi.spyOn(fm, 'loadMapFromStorage').mockReturnValue(makeSerializedMap());
        vi.spyOn(fm, 'loadLastMapSelected').mockReturnValue('Test Map');

        await mapManager.loadMap(null, '', false, '15', [53.4, -2.2]);

        const settingsStore = useSettingsStore(pinia);
        expect(settingsStore.centre?.lat).toBeCloseTo(53.4);
        expect(settingsStore.centre?.lng).toBeCloseTo(-2.2);
        expect(settingsStore.zoom).toBe(15);
    });

    it('does not override stored centre when URL centre has wrong number of elements', async () => {
        vi.spyOn(fm, 'loadMapFromStorage').mockReturnValue(makeSerializedMap());
        vi.spyOn(fm, 'loadLastMapSelected').mockReturnValue('Test Map');

        // Only one element — should not apply
        await mapManager.loadMap(null, '', false, null, [52.5]);

        const settingsStore = useSettingsStore(pinia);
        // Should still be London from settings
        expect(settingsStore.centre?.lat).toBeCloseTo(51.5);
    });
});
