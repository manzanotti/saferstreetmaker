import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { setActivePinia } from 'pinia';

vi.mock('leaflet', () => import('../__mocks__/leaflet'));

import * as L from 'leaflet';
import { pinia } from '../../../src/stores/index';
import { useMapStore } from '../../../src/stores/mapStore';
import { useSettingsStore } from '../../../src/stores/settingsStore';
import { useUiStore } from '../../../src/stores/uiStore';
import { setupMapManager } from '../../../src/composables/useMapManager';
import { FileManager } from '../../../src/services/FileManager';

function makeFileManager(): FileManager {
    const fm = new FileManager();
    vi.spyOn(fm, 'saveMap').mockResolvedValue();
    return fm;
}

describe('useMapManager - loadMap error handling', () => {
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

        vi.spyOn(fm, 'saveMap').mockResolvedValue();

        const uiStore = useUiStore(pinia);
        uiStore.clearErrors();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('shows download link flag when storage load fails', async () => {
        vi.spyOn(fm, 'loadLastMapSelected').mockResolvedValue('Broken map');
        vi.spyOn(fm, 'hasMapInStorage').mockResolvedValue(true);
        vi.spyOn(fm, 'loadMapFromStorage').mockImplementation(async () => {
            throw {
                message: '<b>broken</b>',
                stack: '<script>bad()</script>'
            };
        });

        await mapManager.loadMap(null, '', false, null, null);

        const uiStore = useUiStore(pinia);
        expect(uiStore.showDownloadStorageLink).toBe(true);
        expect(uiStore.errorMessages[0]).toBe(
            'There was a problem loading the map from browser storage:'
        );
        expect(uiStore.errorMessages[1]).toBe('<b>broken</b>');
        expect(uiStore.errorMessages[2]).toBe('<script>bad()</script>');
    });

    it('does not show download link when storage name is unavailable', async () => {
        const settingsStore = useSettingsStore(pinia);
        settingsStore.title = '';

        vi.spyOn(fm, 'loadLastMapSelected').mockResolvedValue('');
        vi.spyOn(fm, 'hasMapInStorage').mockResolvedValue(false);
        vi.spyOn(fm, 'loadMapFromStorage').mockImplementation(async () => {
            throw {
                message: 'broken',
                stack: 'stack'
            };
        });

        await mapManager.loadMap(null, '', false, null, null);

        const uiStore = useUiStore(pinia);
        expect(uiStore.showDownloadStorageLink).toBe(false);
    });

    it('does not let hasMapInStorage failure escape the original loadMap error path', async () => {
        vi.spyOn(fm, 'loadLastMapSelected').mockResolvedValue('Broken map');
        vi.spyOn(fm, 'loadMapFromStorage').mockImplementation(async () => {
            throw {
                message: 'broken',
                stack: 'stack'
            };
        });
        vi.spyOn(fm, 'hasMapInStorage').mockRejectedValue(new Error('metadata unavailable'));

        await expect(mapManager.loadMap(null, '', false, null, null)).resolves.toBe(false);

        const uiStore = useUiStore(pinia);
        expect(uiStore.errorMessages[0]).toBe(
            'There was a problem loading the map from browser storage:'
        );
        expect(uiStore.showDownloadStorageLink).toBe(false);
    });

    it('does not show download link flag for remote file load failures', async () => {
        vi.spyOn(fm, 'loadMapFromRemoteFile').mockImplementation(async () => {
            throw {
                message: '<img src=x onerror=alert(1)>',
                stack: '<script>alert(2)</script>'
            };
        });

        await mapManager.loadMap('/maps/test.json', '', false, null, null);

        const uiStore = useUiStore(pinia);
        expect(uiStore.showDownloadStorageLink).toBe(false);
        expect(uiStore.errorMessages[0]).toBe(
            'There was a problem loading the map from the remote file location:'
        );
        expect(uiStore.errorMessages[1]).toBe('<img src=x onerror=alert(1)>');
        expect(uiStore.errorMessages[2]).toBe('<script>alert(2)</script>');
    });

    it('uses settings title fallback when downloading and LastMapSelected is empty', async () => {
        const settingsStore = useSettingsStore(pinia);
        settingsStore.title = 'Fallback Map';

        vi.spyOn(fm, 'loadLastMapSelected').mockResolvedValue('');
        vi.spyOn(fm, 'loadMapFromStorage').mockResolvedValue({} as any);

        const originalCreateObjectURL = URL.createObjectURL;
        const originalRevokeObjectURL = URL.revokeObjectURL;
        const createObjectURLMock = vi.fn(() => 'blob:test');
        const revokeObjectURLMock = vi.fn();

        Object.defineProperty(URL, 'createObjectURL', {
            value: createObjectURLMock,
            writable: true,
            configurable: true
        });
        Object.defineProperty(URL, 'revokeObjectURL', {
            value: revokeObjectURLMock,
            writable: true,
            configurable: true
        });
        const clickSpy = vi
            .spyOn(HTMLAnchorElement.prototype, 'click')
            .mockImplementation(() => {});

        try {
            await mapManager.downloadStorageMap();

            expect(fm.loadMapFromStorage).toHaveBeenCalledWith('Fallback Map');
            expect(createObjectURLMock).toHaveBeenCalledTimes(1);
            expect(clickSpy).toHaveBeenCalledTimes(1);
        } finally {
            Object.defineProperty(URL, 'createObjectURL', {
                value: originalCreateObjectURL,
                writable: true,
                configurable: true
            });
            Object.defineProperty(URL, 'revokeObjectURL', {
                value: originalRevokeObjectURL,
                writable: true,
                configurable: true
            });
        }
    });

    it('shows a friendly error when loading the stored map for download fails', async () => {
        vi.spyOn(fm, 'loadLastMapSelected').mockResolvedValue('Broken map');
        vi.spyOn(fm, 'loadMapFromStorage').mockImplementation(async () => {
            throw {
                message: '<b>download broken</b>',
                stack: '<script>download()</script>'
            };
        });

        await mapManager.downloadStorageMap();

        const uiStore = useUiStore(pinia);
        expect(uiStore.errorMessages[0]).toBe(
            'There was a problem loading the map from browser storage:'
        );
        expect(uiStore.errorMessages[1]).toBe('<b>download broken</b>');
        expect(uiStore.errorMessages[2]).toBe('<script>download()</script>');
    });

    it('shows a distinct error when browser download creation fails', async () => {
        vi.spyOn(fm, 'loadLastMapSelected').mockResolvedValue('Broken map');
        vi.spyOn(fm, 'loadMapFromStorage').mockResolvedValue({ ok: true } as any);

        const originalCreateObjectURL = URL.createObjectURL;
        Object.defineProperty(URL, 'createObjectURL', {
            value: vi.fn(() => {
                throw {
                    message: 'Blob unavailable',
                    stack: 'stack'
                };
            }),
            writable: true,
            configurable: true
        });

        try {
            await mapManager.downloadStorageMap();

            const uiStore = useUiStore(pinia);
            expect(uiStore.errorMessages).toEqual([
                'There was a problem preparing the map download:',
                'Blob unavailable',
                'stack'
            ]);
        } finally {
            Object.defineProperty(URL, 'createObjectURL', {
                value: originalCreateObjectURL,
                writable: true,
                configurable: true
            });
        }
    });

    it('surfaces a missing stored map during direct storage load', async () => {
        vi.spyOn(fm, 'loadMapFromStorage').mockResolvedValue(null);
        vi.spyOn(fm, 'hasMapInStorage').mockResolvedValue(false);

        await expect(mapManager.loadMapFromStorage('Missing "Map"')).resolves.toBe(false);

        const uiStore = useUiStore(pinia);
        expect(uiStore.showDownloadStorageLink).toBe(false);
        expect(uiStore.errorMessages).toEqual([
            'There was a problem loading the map:',
            'Stored map "Missing "Map"" was not found. It may have been deleted in another tab.'
        ]);
    });
});
