/**
 * Unit tests for useMapManagerActions — the map manager panel's create/load/copy/delete actions.
 */
import { createApp, defineComponent, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SAVE_ERROR_ALREADY_SHOWN } from '../../src/composables/saveErrorMarker';

vi.mock('leaflet', () => import('./__mocks__/leaflet'));

const fileManager = vi.hoisted(() => ({
    loadMapListFromStorage: vi.fn(),
    copyMap: vi.fn(),
    loadMapFromFile: vi.fn(),
    saveMapToFile: vi.fn(),
    saveMapToGeoJSONFile: vi.fn(),
    deleteMapFromStorage: vi.fn()
}));
const mapManager = vi.hoisted(() => ({
    createNewMap: vi.fn(),
    loadMapFromStorage: vi.fn()
}));

vi.mock('../../src/composables/useMapManager', () => ({
    getMapManager: () => mapManager,
    getFileManager: () => fileManager
}));

import { useMapManagerActions } from '../../src/composables/panels/useMapManagerActions';
import { useUiStore } from '../../src/stores/uiStore';

type Actions = ReturnType<typeof useMapManagerActions>;

async function flush(): Promise<void> {
    for (let i = 0; i < 3; i++) {
        await Promise.resolve();
        await nextTick();
    }
}

describe('useMapManagerActions', () => {
    let app: ReturnType<typeof createApp> | null = null;
    let actions: Actions;

    beforeEach(() => {
        Object.values(fileManager).forEach((mock) => mock.mockReset());
        Object.values(mapManager).forEach((mock) => mock.mockReset());
        fileManager.loadMapListFromStorage.mockResolvedValue(['Alpha', 'Beta']);
        fileManager.copyMap.mockResolvedValue(undefined);
        fileManager.deleteMapFromStorage.mockResolvedValue(undefined);
        mapManager.createNewMap.mockResolvedValue(true);
        mapManager.loadMapFromStorage.mockResolvedValue(true);

        const pinia = createPinia();
        setActivePinia(pinia);
        app = createApp(
            defineComponent({
                setup() {
                    actions = useMapManagerActions();
                    return () => null;
                }
            })
        );
        app.use(pinia);
        app.mount(document.createElement('div'));
        useUiStore().openPanel('mapManager');
    });

    afterEach(() => {
        app?.unmount();
        app = null;
    });

    it('loads the stored map list on mount', async () => {
        await flush();
        expect(actions.storedMaps.value).toEqual(['Alpha', 'Beta']);
    });

    it('reports a stored map list failure on mount', async () => {
        app?.unmount();
        fileManager.loadMapListFromStorage.mockRejectedValue(new Error('No storage'));
        const pinia = createPinia();
        setActivePinia(pinia);
        app = createApp(
            defineComponent({
                setup() {
                    actions = useMapManagerActions();
                    return () => null;
                }
            })
        );
        app.use(pinia);
        app.mount(document.createElement('div'));
        await flush();

        expect(useUiStore().errorMessages).toEqual([
            'There was a problem loading the stored map list:',
            'No storage'
        ]);
    });

    it('resets the create form when starting a new map', () => {
        actions.newMapTitle.value = 'Old';
        actions.duplicateTitleError.value = 'Duplicate';
        actions.onNewMap();
        expect(actions.showCreateForm.value).toBe(true);
        expect(actions.newMapTitle.value).toBe('');
        expect(actions.duplicateTitleError.value).toBe('');
    });

    it('ignores blank titles and reports duplicate titles', async () => {
        actions.newMapTitle.value = '   ';
        await actions.onCreate();
        expect(mapManager.createNewMap).not.toHaveBeenCalled();

        mapManager.createNewMap.mockResolvedValue(false);
        actions.newMapTitle.value = ' Alpha ';
        await actions.onCreate();
        expect(mapManager.createNewMap).toHaveBeenCalledWith('Alpha');
        expect(actions.duplicateTitleError.value).toBe('You already have a map named Alpha');
        expect(useUiStore().activePanel).not.toBeNull();
    });

    it('creates a map, hides the form, refreshes the list and closes the panel', async () => {
        actions.onNewMap();
        actions.newMapTitle.value = 'Gamma';
        fileManager.loadMapListFromStorage.mockResolvedValue(['Alpha', 'Beta', 'Gamma']);
        await actions.onCreate();

        expect(actions.showCreateForm.value).toBe(false);
        expect(actions.storedMaps.value).toEqual(['Alpha', 'Beta', 'Gamma']);
        expect(useUiStore().activePanel).toBeNull();
    });

    it('does not repeat a create error that was already shown', async () => {
        mapManager.createNewMap.mockRejectedValue({ [SAVE_ERROR_ALREADY_SHOWN]: true });
        actions.newMapTitle.value = 'Gamma';
        await actions.onCreate();
        expect(useUiStore().errorMessages).toEqual([]);
    });

    it('copies the map and reports copy failures', async () => {
        await actions.onCopyMap();
        expect(fileManager.copyMap).toHaveBeenCalledTimes(1);

        fileManager.copyMap.mockRejectedValue(new Error('Copy failed'));
        await actions.onCopyMap();
        expect(useUiStore().errorMessages).toEqual([
            'There was a problem copying the map:',
            'Copy failed'
        ]);
    });

    it('loads a stored map and closes the panel only when it loaded', async () => {
        mapManager.loadMapFromStorage.mockResolvedValue(false);
        await actions.onLoadStoredMap('Beta');
        expect(useUiStore().activePanel).not.toBeNull();

        mapManager.loadMapFromStorage.mockResolvedValue(true);
        await actions.onLoadStoredMap('Beta');
        expect(mapManager.loadMapFromStorage).toHaveBeenLastCalledWith('Beta');
        expect(useUiStore().activePanel).toBeNull();
    });

    it('deletes a stored map and refreshes the list', async () => {
        fileManager.loadMapListFromStorage.mockResolvedValue(['Alpha']);
        await actions.onDeleteStoredMap('Beta');
        expect(fileManager.deleteMapFromStorage).toHaveBeenCalledWith('Beta');
        expect(actions.storedMaps.value).toEqual(['Alpha']);
    });

    it('saves and exports files, then closes the panel', () => {
        actions.onSaveFile();
        expect(fileManager.saveMapToFile).toHaveBeenCalledTimes(1);
        expect(useUiStore().activePanel).toBeNull();

        actions.onExportGeoJSON();
        expect(fileManager.saveMapToGeoJSONFile).toHaveBeenCalledTimes(1);

        actions.onLoadFile();
        expect(fileManager.loadMapFromFile).toHaveBeenCalledTimes(1);
    });
});
