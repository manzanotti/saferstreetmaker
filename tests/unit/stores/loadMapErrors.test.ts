import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { setActivePinia } from 'pinia';

vi.mock('leaflet', () => import('../__mocks__/leaflet'));

import * as L from 'leaflet';
import { pinia } from '../../../src/stores/index';
import { useMapStore } from '../../../src/stores/mapStore';
import { useUiStore } from '../../../src/stores/uiStore';
import { setupMapManager } from '../../../src/composables/useMapManager';
import { FileManager } from '../../../src/services/FileManager';

function makeFileManager(): FileManager {
    const fm = new FileManager();
    vi.spyOn(fm, 'saveMap').mockImplementation(() => {});
    return fm;
}

describe('useMapManager - loadMap error handling', () => {
    let fm: FileManager;
    let mapManager: ReturnType<typeof setupMapManager>;
    let initialised = false;

    beforeAll(() => {
        setActivePinia(pinia);
        fm = makeFileManager();

        const mapStore = useMapStore(pinia);
        mapStore.setMap(new L.Map() as unknown as L.Map);

        // setupMapManager registers watchers, so initialise once per suite.
        mapManager = setupMapManager(fm);
        initialised = true;
    });

    beforeEach(() => {
        setActivePinia(pinia);

        if (!initialised) {
            fm = makeFileManager();
            const mapStore = useMapStore(pinia);
            mapStore.setMap(new L.Map() as unknown as L.Map);
            mapManager = setupMapManager(fm);
            initialised = true;
        }

        vi.spyOn(fm, 'saveMap').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('shows download link flag when storage load fails', async () => {
        vi.spyOn(fm, 'loadLastMapSelected').mockReturnValue('Broken map');
        vi.spyOn(fm, 'loadMapFromStorage').mockImplementation(() => {
            throw {
                message: '<b>broken</b>',
                stack: '<script>bad()</script>',
            };
        });

        await mapManager.loadMap(null, '', false, null, null);

        const uiStore = useUiStore(pinia);
        expect(uiStore.showDownloadStorageLink).toBe(true);
        expect(uiStore.errorMessages[0]).toBe(
            'There was a problem loading the map from local storage:',
        );
        expect(uiStore.errorMessages[1]).toBe('&lt;b&gt;broken&lt;/b&gt;');
        expect(uiStore.errorMessages[2]).toBe('&lt;script&gt;bad()&lt;/script&gt;');
    });

    it('does not show download link flag for remote file load failures', async () => {
        vi.spyOn(fm, 'loadMapFromRemoteFile').mockImplementation(async () => {
            throw {
                message: '<img src=x onerror=alert(1)>',
                stack: '<script>alert(2)</script>',
            };
        });

        await mapManager.loadMap('/maps/test.json', '', false, null, null);

        const uiStore = useUiStore(pinia);
        expect(uiStore.showDownloadStorageLink).toBe(false);
        expect(uiStore.errorMessages[0]).toBe(
            'There was a problem loading the map from the remote file location:',
        );
        expect(uiStore.errorMessages[1]).toBe('&lt;img src=x onerror=alert(1)&gt;');
        expect(uiStore.errorMessages[2]).toBe('&lt;script&gt;alert(2)&lt;/script&gt;');
    });
});
