import { createApp, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('leaflet', () => import('./__mocks__/leaflet'));

const {
    copyMapMock,
    createNewMapMock,
    deleteMapFromStorageMock,
    loadMapListFromStorageMock,
    loadMapFromStorageMock
} = vi.hoisted(() => {
    return {
        copyMapMock: vi.fn(),
        createNewMapMock: vi.fn(),
        deleteMapFromStorageMock: vi.fn(),
        loadMapListFromStorageMock: vi.fn(),
        loadMapFromStorageMock: vi.fn()
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
            saveMapToFile: vi.fn(),
            saveMapToGeoJSONFile: vi.fn(),
            deleteMapFromStorage: deleteMapFromStorageMock
        })
    };
});

import MapManagerModal from '../../src/components/modals/MapManagerModal.vue';
import { useUiStore } from '../../src/stores/uiStore';

async function flushUi(): Promise<void> {
    await Promise.resolve();
    await nextTick();
    await Promise.resolve();
    await nextTick();
}

describe('MapManagerModal', () => {
    let app: ReturnType<typeof createApp> | null = null;
    let container: HTMLDivElement | null = null;

    beforeEach(() => {
        copyMapMock.mockReset();
        createNewMapMock.mockReset();
        deleteMapFromStorageMock.mockReset();
        loadMapListFromStorageMock.mockReset();
        loadMapFromStorageMock.mockReset();
        copyMapMock.mockResolvedValue(undefined);
        deleteMapFromStorageMock.mockResolvedValue(undefined);
        loadMapListFromStorageMock.mockResolvedValue([]);
        loadMapFromStorageMock.mockResolvedValue(true);

        const pinia = createPinia();
        setActivePinia(pinia);

        container = document.createElement('div');
        document.body.appendChild(container);

        app = createApp(MapManagerModal);
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

    it('shows a friendly error when createNewMap rejects', async () => {
        createNewMapMock.mockRejectedValue(new Error('Storage unavailable'));
        await flushUi();

        const uiStore = useUiStore();
        const newMapButton = container?.querySelector('#new-map') as HTMLInputElement | null;
        const titleInput = container?.querySelector('#new-map-title') as HTMLInputElement | null;
        const createButton = container?.querySelector(
            '#create-new-map button'
        ) as HTMLButtonElement | null;
        const createForm = container?.querySelector('#create-new-map') as HTMLDivElement | null;

        expect(newMapButton).not.toBeNull();
        newMapButton?.click();
        await nextTick();

        expect(titleInput).not.toBeNull();
        if (!titleInput) {
            throw new Error('new-map-title input not found');
        }
        titleInput.value = 'New Failing Map';
        titleInput.dispatchEvent(new Event('input', { bubbles: true }));
        await nextTick();

        expect(createButton).not.toBeNull();
        createButton?.click();
        await flushUi();

        expect(createNewMapMock).toHaveBeenCalledWith('New Failing Map');
        expect(uiStore.errorMessages).toEqual([
            'There was a problem creating the map:',
            'Storage unavailable'
        ]);
        expect(createForm?.classList.contains('hidden')).toBe(false);
    });

    it('shows a friendly error when refreshing the stored map list fails on mount', async () => {
        app?.unmount();
        container?.remove();

        loadMapListFromStorageMock.mockRejectedValue(new Error('List unavailable'));

        const pinia = createPinia();
        setActivePinia(pinia);

        container = document.createElement('div');
        document.body.appendChild(container);

        app = createApp(MapManagerModal);
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

        app = createApp(MapManagerModal);
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

        app = createApp(MapManagerModal);
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

        app = createApp(MapManagerModal);
        app.use(pinia);
        app.mount(container);

        const uiStore = useUiStore();
        uiStore.openModal('mapManager');

        await flushUi();

        const loadMapName = container?.querySelector('.local-map span') as HTMLSpanElement | null;
        const refreshCallCountBeforeClick = loadMapListFromStorageMock.mock.calls.length;

        expect(loadMapName).not.toBeNull();
        loadMapName?.click();
        await flushUi();

        expect(loadMapFromStorageMock).toHaveBeenCalledWith('Alpha');
        expect(loadMapListFromStorageMock).toHaveBeenCalledTimes(refreshCallCountBeforeClick);
        expect(uiStore.activeModal).toBe('mapManager');
    });

    it('shows a list-refresh error when refreshing after copy fails', async () => {
        app?.unmount();
        container?.remove();

        loadMapListFromStorageMock.mockRejectedValue(new Error('List unavailable'));

        const pinia = createPinia();
        setActivePinia(pinia);

        container = document.createElement('div');
        document.body.appendChild(container);

        app = createApp(MapManagerModal);
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

    it('shows a list-refresh error when refreshing after creating a map fails', async () => {
        app?.unmount();
        container?.remove();

        createNewMapMock.mockResolvedValue(true);
        loadMapListFromStorageMock.mockRejectedValue(new Error('List unavailable'));

        const pinia = createPinia();
        setActivePinia(pinia);

        container = document.createElement('div');
        document.body.appendChild(container);

        app = createApp(MapManagerModal);
        app.use(pinia);
        app.mount(container);

        await flushUi();

        const uiStore = useUiStore();
        uiStore.clearErrors();
        uiStore.openModal('mapManager');
        const newMapButton = container?.querySelector('#new-map') as HTMLInputElement | null;
        const titleInput = container?.querySelector('#new-map-title') as HTMLInputElement | null;
        const createButton = container?.querySelector(
            '#create-new-map button'
        ) as HTMLButtonElement | null;

        expect(newMapButton).not.toBeNull();
        newMapButton?.click();
        await nextTick();

        if (!titleInput) {
            throw new Error('new-map-title input not found');
        }
        titleInput.value = 'Created Map';
        titleInput.dispatchEvent(new Event('input', { bubbles: true }));
        await nextTick();

        expect(createButton).not.toBeNull();
        createButton?.click();
        await flushUi();

        expect(uiStore.errorMessages).toEqual([
            'There was a problem loading the stored map list:',
            'List unavailable'
        ]);
        expect(uiStore.activeModal).toBe('mapManager');
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

        app = createApp(MapManagerModal);
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
