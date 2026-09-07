import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useGroupStore } from '../../stores/groupStore';
import { useSelectionStore } from '../../stores/selectionStore';
import { useUiStore } from '../../stores/uiStore';
import { useSettingsStore } from '../../stores/settingsStore';
import {
    applyGroupDetails,
    clearGroupSelection,
    deleteGroup,
    deleteGroupWithElements,
    fitGroupFeatures,
    saveGroupSelectionWhileEditing
} from '../useGroups';
import { getGroupVersions } from '../../features/groups/groupVersions';
import { sanitizeGroupDescription } from '../../features/groups/groupDescription';
import { DEFAULT_GROUP_COLOUR } from '../../features/groups/groupColours';
import { useGroupVersionEditor } from './useGroupVersionEditor';

interface UseGroupDetailsDialogOptions {
    getDialogHeight: () => number;
    getResizeElement: () => Element | null;
    focusNameInput: () => void;
}

export function useGroupDetailsDialog(options: UseGroupDetailsDialogOptions) {
    const groupStore = useGroupStore();
    const selectionStore = useSelectionStore();
    const uiStore = useUiStore();
    const settingsStore = useSettingsStore();
    const group = computed(() =>
        groupStore.groups.find((item) => item.id === groupStore.detailsGroupId)
    );
    const versions = computed(() => (group.value ? getGroupVersions(group.value) : []));

    const name = ref('');
    const color = ref(DEFAULT_GROUP_COLOUR);
    const description = ref('');
    const pendingGroupDelete = ref(false);
    let groupEditReady = false;
    let detailsDirty = false;
    let resizeObserver: ResizeObserver | null = null;
    let detailsPersistenceTimer: ReturnType<typeof setTimeout> | null = null;

    const isOpen = computed(() => groupStore.detailsGroupId !== null && Boolean(group.value));
    const renderedDescription = computed(() => sanitizeGroupDescription(description.value));
    const versionEditor = useGroupVersionEditor({ group, versions, persistDetails });

    function fitFeaturesAboveDialog() {
        fitGroupFeatures(options.getDialogHeight());
    }

    watch(
        isOpen,
        (open) => {
            resizeObserver?.disconnect();
            resizeObserver = null;
            if (!open) {
                return;
            }
            void nextTick(() => {
                const resizeElement = options.getResizeElement();
                if (!resizeElement) {
                    return;
                }
                fitFeaturesAboveDialog();
                resizeObserver = new ResizeObserver(fitFeaturesAboveDialog);
                resizeObserver.observe(resizeElement);
            });
        },
        { immediate: true }
    );

    onBeforeUnmount(() => {
        resizeObserver?.disconnect();
        if (detailsPersistenceTimer) {
            clearTimeout(detailsPersistenceTimer);
        }
    });

    watch(
        () => uiStore.activePanel,
        (activePanel) => {
            if (activePanel === 'groups') {
                close();
            }
        }
    );

    watch(
        () => groupStore.detailsGroupId,
        (id) => {
            const nextGroup = groupStore.groups.find((item) => item.id === id);
            if (!nextGroup) {
                groupEditReady = false;
                detailsDirty = false;
                resetDraft();
                return;
            }
            groupEditReady = false;
            detailsDirty = false;
            name.value = nextGroup.name;
            color.value = nextGroup.color ?? DEFAULT_GROUP_COLOUR;
            description.value = nextGroup.description ?? '';
            versionEditor.cancelVersionEdit();
            versionEditor.syncVersionNames(getGroupVersions(nextGroup));
            versionEditor.pendingVersionDelete.value = null;
            pendingGroupDelete.value = false;
            void nextTick(() => {
                options.focusNameInput();
                groupEditReady = true;
            });
        },
        { immediate: true }
    );

    function resetDraft() {
        name.value = '';
        color.value = DEFAULT_GROUP_COLOUR;
        description.value = '';
        versionEditor.cancelVersionEdit();
        versionEditor.pendingVersionDelete.value = null;
        pendingGroupDelete.value = false;
    }

    function close() {
        persistDetails();
        groupStore.closeDetailsDialog();
        clearGroupSelection();
    }

    function persistDetails() {
        if (detailsPersistenceTimer) {
            clearTimeout(detailsPersistenceTimer);
            detailsPersistenceTimer = null;
        }
        if (
            !settingsStore.readOnly &&
            groupEditReady &&
            detailsDirty &&
            group.value &&
            groupStore.detailsGroupId === group.value.id &&
            name.value.trim()
        ) {
            applyGroupDetails(group.value.id, name.value, color.value, description.value);
            detailsDirty = false;
        }
    }

    function scheduleDetailsPersistence() {
        if (settingsStore.readOnly || !groupEditReady) {
            return;
        }
        detailsDirty = true;
        if (detailsPersistenceTimer) {
            clearTimeout(detailsPersistenceTimer);
        }
        detailsPersistenceTimer = setTimeout(persistDetails, 300);
    }

    function onKeydown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            close();
        }
    }

    watch([name, color, description], scheduleDetailsPersistence, { flush: 'sync' });

    watch(
        () => selectionStore.selected,
        () => {
            if (
                group.value &&
                !settingsStore.readOnly &&
                groupStore.detailsGroupId === group.value.id &&
                groupEditReady &&
                selectionStore.isGroupSelection &&
                selectionStore.selectedGroupId === group.value.id
            ) {
                saveGroupSelectionWhileEditing();
            }
        },
        { deep: true, flush: 'sync' }
    );

    function requestDeleteGroup() {
        pendingGroupDelete.value = true;
    }

    function confirmDeleteGroup(deleteElements: boolean) {
        if (group.value) {
            if (deleteElements) {
                deleteGroupWithElements(group.value.id);
            } else {
                deleteGroup(group.value.id);
            }
        }
        pendingGroupDelete.value = false;
        close();
    }

    return {
        groupStore,
        settingsStore,
        group,
        versions,
        name,
        color,
        description,
        pendingGroupDelete,
        isOpen,
        renderedDescription,
        close,
        onKeydown,
        requestDeleteGroup,
        confirmDeleteGroup,
        ...versionEditor
    };
}
