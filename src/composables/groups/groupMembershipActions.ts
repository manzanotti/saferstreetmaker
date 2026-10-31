import type { GroupMember } from '../../models/Group';
import { useMapStore } from '../../stores/mapStore';
import { useSelectionStore } from '../../stores/selectionStore';
import { useGroupStore } from '../../stores/groupStore';
import { useUiStore } from '../../stores/uiStore';
import { pinia } from '../../stores/index';
import { getAllGroupMembers } from '../../features/groups/groupVersions';
import { buildHistoryId } from '../layers/features/featureLookup';
import { recomputeFeatureVisibility } from './groupRuntime';
import {
    getSelectionMembership,
    splitRemovedSharedVersionMembers,
    performPendingSplits
} from './groupSelectionSplits';

export function createGroupFromSelection(): void {
    const groupStore = useGroupStore(pinia);

    const membership = getSelectionMembership();
    if (!membership) {
        return;
    }

    groupStore.setPendingGroupMembers(membership.fullMembers);
    groupStore.setAddToGroupId(null);

    if (membership.partialSplits.length > 0) {
        groupStore.openSplitDialog(membership.partialSplits);
    } else {
        groupStore.openNameDialog();
    }
}

export function createGroupFromFeature(
    member: GroupMember,
    onCreated?: (groupId: string) => void,
    includeMember = true
): void {
    const groupStore = useGroupStore(pinia);

    groupStore.setPendingGroupMembers(includeMember ? [member] : []);
    groupStore.setAddToGroupId(null);
    groupStore.setPendingGroupCreatedCallback(onCreated ?? null);
    groupStore.openNameDialog();
}

/**
 * Group-first entry point: begin adding features to an existing group. Marks
 * the group as the add target and activates area-selection so the user can
 * rubber-band (or additively click) the features to add. Confirming via the
 * selection toolbar routes through addSelectionToGroup().
 */
export function beginAddToGroup(groupId: string): void {
    const groupStore = useGroupStore(pinia);
    const selectionStore = useSelectionStore(pinia);

    groupStore.setAddToGroupId(groupId);
    selectionStore.clear();
    if (!selectionStore.isActive) {
        selectionStore.activate();
    }
}

/**
 * Add the current selection to an existing group. Mirrors createGroupFromSelection
 * but, instead of creating a new group, folds the selected features into
 * `groupId`. Partially-selected polylines still trigger the split dialog; the
 * split routing (executeSplitsAndProceed / skipSplitsAndProceed) detects the
 * add-target and finalises the add rather than opening the name dialog.
 */
export function addSelectionToGroup(groupId: string): void {
    const groupStore = useGroupStore(pinia);

    const membership = getSelectionMembership();
    if (!membership) {
        return;
    }

    groupStore.setPendingGroupMembers(membership.fullMembers);
    groupStore.setAddToGroupId(groupId);

    if (membership.partialSplits.length > 0) {
        groupStore.openSplitDialog(membership.partialSplits);
    } else {
        finalizeAddToGroup();
    }
}

/**
 * Replace the active version's members with the current selection after a
 * user edits a group selection with modifier-clicks.
 */
export function saveGroupSelection(): void {
    commitGroupSelection(false);
}

export function saveGroupSelectionWhileEditing(): void {
    commitGroupSelection(true);
}

function commitGroupSelection(keepEditing: boolean): void {
    const selectionStore = useSelectionStore(pinia);
    const groupId = selectionStore.selectedGroupId;
    if (!groupId || !selectionStore.isGroupSelection) {
        return;
    }

    const membership = getSelectionMembership() ?? { fullMembers: [], partialSplits: [] };
    if (membership.partialSplits.length > 0) {
        return;
    }

    const groupStore = useGroupStore(pinia);
    const mapStore = useMapStore(pinia);
    const uiStore = useUiStore(pinia);
    splitRemovedSharedVersionMembers(groupId, membership.fullMembers);
    const updated = groupStore.replaceActiveVersionMembers(groupId, membership.fullMembers);
    if (!updated) {
        return;
    }

    recomputeFeatureVisibility();
    if (!keepEditing) {
        selectionStore.deactivate();
    }
    mapStore.markLayerUpdated();

    const updatedGroup = groupStore.groups.find((group) => group.id === groupId);
    if (updatedGroup && getAllGroupMembers(updatedGroup).length === 0) {
        groupStore.setPendingEmptyGroupDeletion(groupId);
        uiStore.openPanel('groups');
    }
}

/**
 * Finalise adding the pending members (plus any split lines) to the target
 * group in a single checkpoint, then clear state and close the selection.
 */
export function finalizeAddToGroup(): void {
    const groupStore = useGroupStore(pinia);
    const mapStore = useMapStore(pinia);

    const targetGroupId = groupStore.addToGroupId;
    if (!targetGroupId) {
        return;
    }

    const splitMembers = performPendingSplits();
    const members = [...groupStore.pendingGroupMembers, ...splitMembers];

    groupStore.addMembersToGroup(targetGroupId, members);
    groupStore.clearPendingState();

    // Newly added members must honour the target group's current visibility.
    recomputeFeatureVisibility();

    // Close the selection pop-up now the add is complete.
    useSelectionStore(pinia).deactivate();

    mapStore.markLayerUpdated();
}

/**
 * Called from PartialPolylineDialog when the user accepts splitting.
 * The actual split is deferred until the group is confirmed (finalizeCreateGroup)
 * so cancelling the name dialog does not mutate the map. pendingSplits is kept.
 */
export function executeSplitsAndProceed(): void {
    const groupStore = useGroupStore(pinia);
    groupStore.approveSplitDialog();
    if (groupStore.addToGroupId) {
        finalizeAddToGroup();
    } else {
        groupStore.openNameDialog();
    }
}

/**
 * Called from PartialPolylineDialog when the user declines splitting.
 * Discards the pending splits and proceeds without the partial polylines.
 */
export function skipSplitsAndProceed(): void {
    const groupStore = useGroupStore(pinia);
    groupStore.closeSplitDialog();
    if (groupStore.addToGroupId) {
        finalizeAddToGroup();
    } else {
        groupStore.openNameDialog();
    }
}

/**
 * Called from GroupNameDialog on save (create mode).
 * Performs any approved polyline splits, creates the group, and triggers a
 * single snapshot checkpoint covering both the split and the new group.
 */
export function finalizeCreateGroup(name: string, description = ''): void {
    if (!name.trim()) {
        return;
    }

    const groupStore = useGroupStore(pinia);
    const mapStore = useMapStore(pinia);

    const splitMembers = performPendingSplits();
    const id = buildHistoryId('group');
    const members = [...groupStore.pendingGroupMembers, ...splitMembers];

    groupStore.addGroup({ id, name: name.trim(), description, members });
    groupStore.consumePendingGroupCreatedCallback()?.(id);
    groupStore.clearPendingState();
    groupStore.closeNameDialog();

    // Close the area-selection pop-up now that the group exists: deactivating
    // clears the selection and hides the AreaSelectionPanel.
    useSelectionStore(pinia).deactivate();

    mapStore.markLayerUpdated();
}

/**
 * Called from GroupNameDialog on save (rename mode).
 */
export function finalizeRenameGroup(id: string, name: string): void {
    if (!name.trim()) {
        return;
    }

    const groupStore = useGroupStore(pinia);
    const mapStore = useMapStore(pinia);

    groupStore.renameGroup(id, name.trim());
    groupStore.closeNameDialog();

    mapStore.markLayerUpdated();
}
