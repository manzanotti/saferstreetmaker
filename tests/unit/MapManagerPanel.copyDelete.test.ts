/**
 * Unit tests for MapManagerPanel — copying, exporting and deleting maps.
 */
import { createApp, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('leaflet', () => import('./__mocks__/leaflet'));

const {
    copyMapMock,
    createNewMapMock,
    deleteMapFromStorageMock,
    loadMapListFromStorageMock,
    loadMapFromStorageMock,
    saveMapToFileMock,
    saveMapToGeoJSONFileMock
} = vi.hoisted(() => {
    return {
        copyMapMock: vi.fn(),
        createNewMapMock: vi.fn(),
        deleteMapFromStorageMock: vi.fn(),
        loadMapListFromStorageMock: vi.fn(),
        loadMapFromStorageMock: vi.fn(),
        saveMapToFileMock: vi.fn(),
        saveMapToGeoJSONFileMock: vi.fn()
    };
});

vi.mock('../../src/composables/useMapManager', () => {
    return {
        getMapManager: () => ({
            createNewMap: createNewMapMock,
            loadMapFromStorage: loadMapFromStorageMock
        }),
        getFileManager: () => ({
            loadMapListFromStorage: loadMapListFromStorageMock,
            copyMap: copyMapMock,
            loadMapFromFile: vi.fn(),
            saveMapToFile: saveMapToFileMock,
            saveMapToGeoJSONFile: saveMapToGeoJSONFileMock,
            deleteMapFromStorage: deleteMapFromStorageMock
        })
    };
});

import MapManagerPanel from '../../src/components/panels/MapManagerPanel.vue';
import { useImportedLayerStore } from '../../src/stores/importedLayerStore';
import { useUiStore } from '../../src/stores/uiStore';

async function flushUi(): Promise<void> {
    await Promise.resolve();
    await nextTick();
    await Promise.resolve();
    await nextTick();
}

describe('MapManagerPanel', () => {
    let app: ReturnType<typeof createApp> | null = null;
    let container: HTMLDivElement | null = null;

    beforeEach(() => {
        copyMapMock.mockReset();
        createNewMapMock.mockReset();
        deleteMapFromStorageMock.mockReset();
        loadMapListFromStorageMock.mockReset();
        loadMapFromStorageMock.mockReset();
        saveMapToFileMock.mockReset();
        saveMapToGeoJSONFileMock.mockReset();
        copyMapMock.mockResolvedValue(undefined);
        deleteMapFromStorageMock.mockResolvedValue(undefined);
        loadMapListFromStorageMock.mockResolvedValue([]);
        loadMapFromStorageMock.mockResolvedValue(true);

        const pinia = createPinia();
        setActivePinia(pinia);

        container = document.createElement('div');
        document.body.appendChild(container);

        app = createApp(MapManagerPanel);
        app.use(pinia);
        app.mount(container);
    });

    afterEach(() => {
        app?.unmount();
        app = null;
        container?.remove();
        container = null;
        document.body.innerHTML = '';
    });

    it('shows a list-refresh error when refreshing after copy fails', async () => {
        app?.unmount();
        container?.remove();

        loadMapListFromStorageMock.mockRejectedValue(new Error('List unavailable'));

        const pinia = createPinia();
        setActivePinia(pinia);

        container = document.createElement('div');
        document.body.appendChild(container);

        app = createApp(MapManagerPanel);
        app.use(pinia);
        app.mount(container);

        await flushUi();

        const uiStore = useUiStore();
        uiStore.clearErrors();
        const copyButton = container?.querySelector('#copy-map') as HTMLInputElement | null;

        expect(copyButton).not.toBeNull();
        copyButton?.click();
        await flushUi();

        expect(copyMapMock).toHaveBeenCalledTimes(1);
        expect(uiStore.errorMessages).toEqual([
            'There was a problem loading the stored map list:',
            'List unavailable'
        ]);
    });

    it('includes imported layers when copying and exporting maps', async () => {
        const importedLayerStore = useImportedLayerStore();
        importedLayerStore.addLayer({
            id: 'imported-1',
            name: 'Imported layer',
            nameProperty: null,
            visible: true,
            featureCollection: { type: 'FeatureCollection', features: [] }
        });
        await flushUi();

        (container?.querySelector('#copy-map') as HTMLButtonElement | null)?.click();
        await flushUi();
        (container?.querySelector('#save-file') as HTMLButtonElement | null)?.click();
        (container?.querySelector('#save-geojson-file') as HTMLButtonElement | null)?.click();

        expect(copyMapMock.mock.calls[0]?.[3]).toEqual(importedLayerStore.layers);
        expect(saveMapToFileMock.mock.calls[0]?.[3]).toEqual(importedLayerStore.layers);
        expect(saveMapToGeoJSONFileMock.mock.calls[0]?.[2]).toEqual(importedLayerStore.layers);
    });

    it('shows a list-refresh error when refreshing after deleting a map fails', async () => {
        app?.unmount();
        container?.remove();

        loadMapListFromStorageMock
            .mockResolvedValueOnce(['Alpha'])
            .mockRejectedValueOnce(new Error('List unavailable'));

        const pinia = createPinia();
        setActivePinia(pinia);

        container = document.createElement('div');
        document.body.appendChild(container);

        app = createApp(MapManagerPanel);
        app.use(pinia);
        app.mount(container);

        await flushUi();

        const uiStore = useUiStore();
        const deleteButton = container?.querySelector('.delete-button') as HTMLInputElement | null;

        expect(deleteButton).not.toBeNull();
        deleteButton?.click();
        await flushUi();

        expect(deleteMapFromStorageMock).toHaveBeenCalledWith('Alpha');
        expect(uiStore.errorMessages).toEqual([
            'There was a problem loading the stored map list:',
            'List unavailable'
        ]);
    });
});
