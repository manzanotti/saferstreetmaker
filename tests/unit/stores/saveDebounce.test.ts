/**
 * Unit tests for the save debounce logic in useMapManager.
 *
 * These tests verify that:
 *  1. zoom/pan changes are debounced — rapid changes don't each trigger a save.
 *  2. a single save fires after the debounce window elapses.
 *  3. layer-data changes (markers placed, features edited) are saved immediately
 *     without debouncing.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { setActivePinia } from 'pinia';
import { nextTick } from 'vue';

vi.mock('leaflet', () => import('../__mocks__/leaflet'));

import * as L from 'leaflet';
import { pinia } from '../../../src/stores/index';
import { useMapStore } from '../../../src/stores/mapStore';
import { useSettingsStore } from '../../../src/stores/settingsStore';
import { setupMapManager } from '../../../src/composables/useMapManager';
import { FileManager } from '../../../src/services/FileManager';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFileManager(): FileManager {
    const fm = new FileManager();
    vi.spyOn(fm, 'saveMap').mockImplementation(() => {});
    return fm;
}

// ---------------------------------------------------------------------------
describe('useMapManager – save debounce', () => {
    let fm: FileManager;
    let initialised = false;

    beforeEach(() => {
        // Use the same pinia singleton that useMapManager internals use.
        setActivePinia(pinia);
        vi.useFakeTimers();

        if (!fm) {
            fm = new FileManager();
        }
        vi.spyOn(fm, 'saveMap').mockImplementation(() => {});

        const mapStore = useMapStore(pinia);
        mapStore.setMap(new L.Map() as unknown as L.Map);

        if (!initialised) {
            setupMapManager(fm);
            initialised = true;
        }
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    // ── View change (zoom / pan) ───────────────────────────────────────────────

    it('does not save immediately when zoom changes', async () => {
        const settingsStore = useSettingsStore(pinia);
        settingsStore.zoom = 10;
        await nextTick();

        expect(fm.saveMap).not.toHaveBeenCalled();
    });

    it('saves once after the debounce window (500 ms) following a zoom change', async () => {
        // Make two changes separated by less than 500ms to ensure we're testing
        // the current test's watcher (not a stale one from a previous test run).
        const settingsStore = useSettingsStore(pinia);

        settingsStore.zoom = 10;
        await nextTick();
        vi.advanceTimersByTime(200); // restart window with a second change

        settingsStore.zoom = 11;
        await nextTick();

        // Advance past the full 500 ms debounce window
        vi.advanceTimersByTime(500);
        await nextTick();

        expect(fm.saveMap).toHaveBeenCalledTimes(1);
    });

    it('coalesces multiple rapid zoom changes into a single save', async () => {
        const settingsStore = useSettingsStore(pinia);

        settingsStore.zoom = 10;
        await nextTick();
        vi.advanceTimersByTime(200);

        settingsStore.zoom = 11;
        await nextTick();
        vi.advanceTimersByTime(200);

        settingsStore.zoom = 12;
        await nextTick();
        vi.advanceTimersByTime(200);

        // Still within debounce window of the last change — no save yet
        expect(fm.saveMap).not.toHaveBeenCalled();

        // Let the final debounce fire
        vi.advanceTimersByTime(300);
        await nextTick();
        expect(fm.saveMap).toHaveBeenCalledTimes(1);
    });

    it('coalesces a mix of zoom and centre changes into a single save', async () => {
        const settingsStore = useSettingsStore(pinia);

        settingsStore.zoom = 14;
        await nextTick();
        vi.advanceTimersByTime(100);

        settingsStore.centre = new L.LatLng(52.5, -1.9) as unknown as L.LatLng;
        await nextTick();
        vi.advanceTimersByTime(100);

        settingsStore.zoom = 15;
        await nextTick();
        vi.advanceTimersByTime(100);

        expect(fm.saveMap).not.toHaveBeenCalled();

        vi.advanceTimersByTime(400);
        await nextTick();
        expect(fm.saveMap).toHaveBeenCalledTimes(1);
    });

    // ── Layer data changes ─────────────────────────────────────────────────────

    it('saves immediately (no debounce) when a layer is updated', async () => {
        const mapStore = useMapStore(pinia);
        mapStore.markLayerUpdated();
        await nextTick();

        expect(fm.saveMap).toHaveBeenCalledTimes(1);
    });

    it('saves once per layer update, not batched', async () => {
        const mapStore = useMapStore(pinia);

        mapStore.markLayerUpdated();
        await nextTick();
        mapStore.markLayerUpdated();
        await nextTick();

        expect(fm.saveMap).toHaveBeenCalledTimes(2);
    });
});
