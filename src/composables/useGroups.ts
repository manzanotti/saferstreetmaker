import { useMapStore } from '../stores/mapStore';
import { useSelectionStore } from '../stores/selectionStore';
import { useGroupStore } from '../stores/groupStore';
import { useUiStore } from '../stores/uiStore';
import { useSettingsStore } from '../stores/settingsStore';
import { pinia } from '../stores/index';
import {
    getActiveVersion,
    getNewPhaseDraftMembers,
    getGroupVersions,
    needsReadOnlyGroupDetails
} from '../features/groups/groupVersions';
import { buildHistoryId } from './layers/features/featureLookup';
import { setMapCursor } from './layers/features/featureCursors';
import { applySelectionHighlights, clearFeatureHighlight } from './useAreaSelection';
import { useGroupPhaseEditing } from './groups/useGroupPhaseEditing';
import { createGroupMutations } from '../features/groups/groupMutations';
import {
    buildEntriesForMembers,
    findMarkerByHistoryId,
    groupLtnFillController,
    groupVisibilityController,
    markPhaseMutation,
    phaseHighlighter,
    recomputeFeatureVisibility
} from './groups/groupRuntime';
import { selectGroup } from './groups/groupSelection';
import {
    applyReadOnlyGroupPresentation,
    clearReadOnlyGroupPresentation,
    clearReadOnlyEditingState,
    stopReadOnlyGroupPlayback
} from './groups/groupReadOnlyPresentation';

export {
    recomputeFeatureVisibility,
    resetGroupVisibility,
    clearGroupSelection
} from './groups/groupRuntime';
export {
    applyGroupColor,
    applyGroupDescription,
    applyGroupDetails,
    removeFeatureFromGroup,
    addFeatureToGroup
} from './groups/groupMetadataActions';
export {
    createGroupFromSelection,
    createGroupFromFeature,
    beginAddToGroup,
    addSelectionToGroup,
    saveGroupSelection,
    saveGroupSelectionWhileEditing,
    finalizeAddToGroup,
    executeSplitsAndProceed,
    skipSplitsAndProceed,
    finalizeCreateGroup,
    finalizeRenameGroup
} from './groups/groupMembershipActions';
export { selectGroup, fitGroupFeatures, fitGroupPhaseFeatures } from './groups/groupSelection';
export {
    applyReadOnlyGroupPresentation,
    clearReadOnlyGroupPresentation,
    clearReadOnlyEditingState,
    focusReadOnlyGroupPhase,
    stepReadOnlyGroupPhase,
    startReadOnlyGroupPlayback,
    stopReadOnlyGroupPlayback
} from './groups/groupReadOnlyPresentation';

const groupPhaseEditing = useGroupPhaseEditing({
    phaseHighlighter,
    buildEntriesForMembers,
    markPhaseMutation,
    recomputeFeatureVisibility,
    stopReadOnlyGroupPlayback,
    startNewGroupPhase
});

export const {
    openGroupPhases,
    refreshGroupPhasePresentation,
    focusGroupPhase,
    confirmEmptyGroupPhaseDeletion,
    reorderGroupPhases,
    closeGroupPhases
} = groupPhaseEditing;

export function openGroupDetails(id: string): void {
    const groupStore = useGroupStore(pinia);
    const uiStore = useUiStore(pinia);
    const selectionStore = useSelectionStore(pinia);
    if (groupStore.phasesDialogOpen) {
        closeGroupPhases();
    }
    const readOnly = useSettingsStore(pinia).readOnly;
    const group = groupStore.groups.find((item) => item.id === id);
    if (readOnly) {
        clearReadOnlyEditingState();
    }
    selectGroup(id, !readOnly);
    if (selectionStore.selectedGroupId !== id) {
        selectionStore.setSelected([]);
        selectionStore.markGroupSelection(id);
    }
    if (!readOnly) {
        setMapCursor('group-edit');
    }
    uiStore.closePanel();
    if (!readOnly || (group && needsReadOnlyGroupDetails(group))) {
        groupStore.openDetailsDialog(id);
    } else {
        stopReadOnlyGroupPlayback();
        clearReadOnlyGroupPresentation();
        groupStore.closeDetailsDialog();
    }
    if (readOnly) {
        if (group) {
            const versionId = groupStore.activeVersionIds[id] ?? getGroupVersions(group)[0]?.id;
            if (versionId) {
                groupStore.setReadOnlyPhaseContext(id, versionId);
            }
            applyReadOnlyGroupPresentation(getActiveVersion(group, versionId));
        }
    }
}

export function switchGroupVersion(groupId: string, versionId: string): boolean {
    const groupStore = useGroupStore(pinia);
    const mapStore = useMapStore(pinia);
    const selectionStore = useSelectionStore(pinia);
    const switched = groupStore.setActiveVersion(groupId, versionId);
    if (switched) {
        const detailsOpen = groupStore.detailsGroupId === groupId;
        if (detailsOpen) {
            groupStore.closeDetailsDialog();
        }
        const previousSelection = selectionStore.selected;
        applySelectionHighlights([], true, previousSelection);
        selectionStore.setSelected([]);
        recomputeFeatureVisibility();
        selectGroup(groupId);
        if (detailsOpen) {
            groupStore.openDetailsDialog(groupId);
        }
        groupLtnFillController.recompute();
        mapStore.markLayerUpdated();
    }
    return switched;
}

export function viewGroupVersion(groupId: string, versionId: string): boolean {
    if (!useSettingsStore(pinia).readOnly) {
        return false;
    }
    const groupStore = useGroupStore(pinia);
    const group = groupStore.groups.find((item) => item.id === groupId);
    const version = group ? getGroupVersions(group).find((item) => item.id === versionId) : null;
    if (!group || !version) {
        return false;
    }
    stopReadOnlyGroupPlayback();
    clearReadOnlyEditingState();
    const selectionStore = useSelectionStore(pinia);
    applySelectionHighlights([], true, selectionStore.selected);
    selectionStore.setSelected([]);
    selectionStore.markGroupSelection(groupId);
    groupStore.setActiveVersion(groupId, versionId);
    groupStore.setReadOnlyPhaseContext(groupId, versionId);
    recomputeFeatureVisibility();
    groupLtnFillController.recompute();
    selectGroup(groupId, false);
    applyReadOnlyGroupPresentation(version);
    return true;
}

export function showReplayedGroupPhases(
    groupId: string,
    versionId: string,
    phaseId: string | null
): boolean {
    const groupStore = useGroupStore(pinia);
    const group = groupStore.groups.find((item) => item.id === groupId);
    const version = group ? getGroupVersions(group).find((item) => item.id === versionId) : null;
    if (!group || !version) {
        return false;
    }

    const selectionStore = useSelectionStore(pinia);
    if (groupStore.activeVersionIds[groupId] !== versionId) {
        groupStore.setActiveVersion(groupId, versionId);
        recomputeFeatureVisibility();
    }
    phaseHighlighter.clear(version.members);
    groupStore.openPhasesDialog(groupId, versionId);
    groupStore.closeDetailsDialog();
    applySelectionHighlights([], true, selectionStore.selected);
    selectionStore.deactivate();
    useUiStore(pinia).closePanel();
    groupStore.phaseDraftActive = false;

    return phaseId ? focusGroupPhase(phaseId) : true;
}

export function startNewGroupPhase(): boolean {
    if (useSettingsStore(pinia).readOnly) {
        return false;
    }
    const groupStore = useGroupStore(pinia);
    const group = groupStore.phaseGroupId
        ? groupStore.groups.find((item) => item.id === groupStore.phaseGroupId)
        : null;
    const version =
        group && groupStore.phaseVersionId
            ? getGroupVersions(group).find((item) => item.id === groupStore.phaseVersionId)
            : null;
    if (!group || !version) {
        return false;
    }
    const draftMembers = getNewPhaseDraftMembers(version);
    if (draftMembers.length === 0) {
        return false;
    }
    const phaseId = buildHistoryId('phase');
    const before = version.phases ?? [];
    const after = [...before, { id: phaseId, members: draftMembers }];
    if (!groupStore.replaceVersionPhases(group.id, version.id, after)) {
        return false;
    }
    markPhaseMutation(group.id, version.id, phaseId, before, after);
    return focusGroupPhase(phaseId);
}

export const {
    createGroupVersion,
    renameGroupVersion,
    setGroupDefaultVersion,
    deleteGroupVersion,
    deleteGroupWithElements,
    removeAllGroupElements,
    deleteGroup,
    toggleGroupVisibility,
    setAllGroupsVisibility,
    pruneDanglingGroupMembers
} = createGroupMutations({
    clearFeatureHighlight,
    findMarkerByHistoryId,
    recomputeFeatureVisibility,
    revealMarker: (marker) => groupVisibilityController.reveal(marker),
    switchGroupVersion
});
