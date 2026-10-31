import { onMounted, ref } from 'vue';
import { useSettingsStore } from '../../stores/settingsStore';
import { useMapStore } from '../../stores/mapStore';
import { useUiStore } from '../../stores/uiStore';
import { useGroupStore } from '../../stores/groupStore';
import { useImportedLayerStore } from '../../stores/importedLayerStore';
import { getMapManager, getFileManager } from '../useMapManager';
import { isSaveErrorAlreadyShown } from '../saveErrorMarker';

function errorText(e: any): string {
    return String(e?.message ?? e);
}

export function useMapManagerActions() {
    const settingsStore = useSettingsStore();
    const mapStore = useMapStore();
    const uiStore = useUiStore();
    const groupStore = useGroupStore();
    const importedLayerStore = useImportedLayerStore();

    const showCreateForm = ref(false);
    const newMapTitle = ref('');
    const duplicateTitleError = ref('');
    const storedMaps = ref<string[]>([]);

    async function refreshMapList() {
        storedMaps.value = await getFileManager().loadMapListFromStorage();
    }

    function showMapListError(e: any) {
        uiStore.showErrors(['There was a problem loading the stored map list:', errorText(e)]);
    }

    function showStoredMapLoadError(e: any) {
        uiStore.showErrors(['There was a problem loading the stored map:', errorText(e)]);
    }

    onMounted(() => {
        void refreshMapList().catch((e) => {
            showMapListError(e);
        });
    });

    function onNewMap() {
        showCreateForm.value = true;
        newMapTitle.value = '';
        duplicateTitleError.value = '';
    }

    async function onCopyMap() {
        try {
            await getFileManager().copyMap(
                settingsStore.toSettings(),
                mapStore.toLayers(),
                groupStore.groups,
                importedLayerStore.layers
            );
        } catch (e: any) {
            uiStore.showErrors(['There was a problem copying the map:', errorText(e)]);
            return;
        }

        try {
            await refreshMapList();
        } catch (e: any) {
            showMapListError(e);
        }
    }

    async function onCreate() {
        const title = newMapTitle.value.trim();
        if (!title) {
            return;
        }

        try {
            const ok = await getMapManager().createNewMap(title);
            if (!ok) {
                duplicateTitleError.value = `You already have a map named ${title}`;
                return;
            }
        } catch (e: any) {
            if (isSaveErrorAlreadyShown(e)) {
                return;
            }
            uiStore.showErrors(['There was a problem creating the map:', errorText(e)]);
            return;
        }

        showCreateForm.value = false;

        try {
            await refreshMapList();
        } catch (e: any) {
            showMapListError(e);
            return;
        }

        uiStore.closePanel();
    }

    function onLoadFile() {
        getFileManager().loadMapFromFile();
    }

    function onSaveFile() {
        getFileManager().saveMapToFile(
            settingsStore.toSettings(),
            mapStore.toLayers(),
            groupStore.groups,
            importedLayerStore.layers
        );
        uiStore.closePanel();
    }

    function onExportGeoJSON() {
        getFileManager().saveMapToGeoJSONFile(
            settingsStore.toSettings(),
            mapStore.toLayers(),
            importedLayerStore.layers
        );
        uiStore.closePanel();
    }

    async function onLoadStoredMap(mapName: string) {
        try {
            const loaded = await getMapManager().loadMapFromStorage(mapName);
            if (!loaded) {
                return;
            }
        } catch (e: any) {
            showStoredMapLoadError(e);
            return;
        }

        try {
            await refreshMapList();
        } catch (e: any) {
            showMapListError(e);
            return;
        }

        uiStore.closePanel();
    }

    async function onDeleteStoredMap(mapName: string) {
        try {
            await getFileManager().deleteMapFromStorage(mapName);
        } catch (e: any) {
            uiStore.showErrors(['There was a problem deleting the stored map:', errorText(e)]);
            return;
        }

        try {
            await refreshMapList();
        } catch (e: any) {
            showMapListError(e);
        }
    }

    function onClose() {
        uiStore.closePanel();
    }

    return {
        settingsStore,
        showCreateForm,
        newMapTitle,
        duplicateTitleError,
        storedMaps,
        onNewMap,
        onCopyMap,
        onCreate,
        onLoadFile,
        onSaveFile,
        onExportGeoJSON,
        onLoadStoredMap,
        onDeleteStoredMap,
        onClose
    };
}
