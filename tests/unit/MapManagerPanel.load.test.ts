/**
 * Unit tests for MapManagerPanel — loading stored maps and refreshing the list.
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

    it('shows a friendly error when refreshing the stored map list fails on mount', async () => {
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
        expect(uiStore.errorMessages).toEqual([
            'There was a problem loading the stored map list:',
            'List unavailable'
        ]);
    });

    it('shows a friendly error when refreshing the stored map list fails after loading a map', async () => {
        app?.unmount();
        container?.remove();

        loadMapListFromStorageMock.mockResolvedValueOnce(['Alpha']);
        loadMapListFromStorageMock.mockRejectedValueOnce(new Error('List unavailable'));

        const pinia = createPinia();
        setActivePinia(pinia);

        container = document.createElement('div');
        document.body.appendChild(container);

        app = createApp(MapManagerPanel);
        app.use(pinia);
        app.mount(container);

        await flushUi();

        const uiStore = useUiStore();
        const loadMapName = container?.querySelector('.local-map span') as HTMLSpanElement | null;

        expect(loadMapName).not.toBeNull();
        loadMapName?.click();
        await flushUi();

        expect(loadMapFromStorageMock).toHaveBeenCalledWith('Alpha');
        expect(uiStore.errorMessages).toEqual([
            'There was a problem loading the stored map list:',
            'List unavailable'
        ]);
    });

    it('shows a stored-map load error when loading the map itself rejects', async () => {
        app?.unmount();
        container?.remove();

        loadMapListFromStorageMock.mockResolvedValue(['Alpha']);
        loadMapFromStorageMock.mockRejectedValue(new Error('Load unavailable'));

        const pinia = createPinia();
        setActivePinia(pinia);

        container = document.createElement('div');
        document.body.appendChild(container);

        app = createApp(MapManagerPanel);
        app.use(pinia);
        app.mount(container);

        await flushUi();

        const uiStore = useUiStore();
        const loadMapName = container?.querySelector('.local-map span') as HTMLSpanElement | null;

        expect(loadMapName).not.toBeNull();
        loadMapName?.click();
        await flushUi();

        expect(uiStore.errorMessages).toEqual([
            'There was a problem loading the stored map:',
            'Load unavailable'
        ]);
    });

    it('keeps the modal open when loading a stored map reports failure', async () => {
        app?.unmount();
        container?.remove();

        loadMapListFromStorageMock.mockResolvedValue(['Alpha']);
        loadMapFromStorageMock.mockResolvedValue(false);

        const pinia = createPinia();
        setActivePinia(pinia);

        container = document.createElement('div');
        document.body.appendChild(container);

        app = createApp(MapManagerPanel);
        app.use(pinia);
        app.mount(container);

        const uiStore = useUiStore();
        uiStore.openPanel('mapManager');

        await flushUi();

        const loadMapName = container?.querySelector('.local-map span') as HTMLSpanElement | null;
        const refreshCallCountBeforeClick = loadMapListFromStorageMock.mock.calls.length;

        expect(loadMapName).not.toBeNull();
        loadMapName?.click();
        await flushUi();

        expect(loadMapFromStorageMock).toHaveBeenCalledWith('Alpha');
        expect(loadMapListFromStorageMock).toHaveBeenCalledTimes(refreshCallCountBeforeClick);
        expect(uiStore.activePanel).toBe('mapManager');
    });
});
