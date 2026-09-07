import * as L from 'leaflet';
import { useMapStore } from '../../stores/mapStore';
import { useSelectionStore } from '../../stores/selectionStore';
import { useGroupStore } from '../../stores/groupStore';
import { useUiStore } from '../../stores/uiStore';
import { useSettingsStore } from '../../stores/settingsStore';
import {
    featureKey,
    getActiveVersion,
    getGroupVersions,
    needsReadOnlyGroupDetails
} from '../../features/groups/groupVersions';
import { pinia } from '../../stores/index';
import { buildHistoryId, getFeatureHistoryId, setMapCursor } from '../layers/layerUtils';
import { applySelectionHighlights, clearFeatureHighlight } from '../useAreaSelection';
import type { GroupMember } from '../../models/Group';
import { normalizeGroupColour } from '../../features/groups/groupColours';
import {
    findMarkerByHistoryId,
    groupVisibilityController,
    performPendingSplits
} from './groupsShared';
import { recomputeFeatureVisibility, selectGroup } from './useGroupVisibility';
import {
    applyReadOnlyGroupPresentation,
    clearReadOnlyEditingState,
    clearReadOnlyGroupPresentation
} from './useGroupReadOnlyPresentation';
import { closeGroupPhases, stopReadOnlyGroupPlayback } from './useGroupPhases';

export function applyGroupColor(id: string, color: string): boolean {
    const normalizedColor = normalizeGroupColour(color);
    const groupStore = useGroupStore(pinia);
    const mapStore = useMapStore(pinia);
    const group = groupStore.groups.find((item) => item.id === id);
    if (!group || !normalizedColor || group.color === normalizedColor) {
        return false;
    }

    groupStore.setColor(id, normalizedColor);
    recomputeFeatureVisibility();
    mapStore.markLayerUpdated();
    return true;
}

export function applyGroupDescription(id: string, description: string): boolean {
    const groupStore = useGroupStore(pinia);
    const mapStore = useMapStore(pinia);
    const updated = groupStore.setDescription(id, description);
    if (!updated) {
        return false;
    }

    mapStore.markLayerUpdated();
    return true;
}

export function applyGroupDetails(
    id: string,
    name: string,
    color: string,
    description: string
): boolean {
    const groupStore = useGroupStore(pinia);
    const mapStore = useMapStore(pinia);
    const normalizedColor = normalizeGroupColour(color) ?? '';
    const updated = groupStore.setMetadata(id, name, normalizedColor, description);
    if (!updated) {
        return false;
    }

    recomputeFeatureVisibility();
    mapStore.markLayerUpdated();
    return true;
}

export function removeFeatureFromGroup(groupId: string, member: GroupMember): boolean {
    const groupStore = useGroupStore(pinia);
    const group = groupStore.groups.find((item) => item.id === groupId);
    if (!group) {
        return false;
    }

    const versionIds = getGroupVersions(group).map((version) => version.id);
    const removed = groupStore.removeMemberFromVersions(groupId, versionIds, member);
    if (!removed) {
        return false;
    }

    recomputeFeatureVisibility();
    useMapStore(pinia).markLayerUpdated();
    return true;
}

export function addFeatureToGroup(groupId: string, member: GroupMember): boolean {
    const groupStore = useGroupStore(pinia);
    const group = groupStore.groups.find((item) => item.id === groupId);
    if (!group) {
        return false;
    }

    groupStore.addMembersToGroup(groupId, [member]);
    recomputeFeatureVisibility();
    useMapStore(pinia).markLayerUpdated();
    return true;
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

/**
 * Delete a group AND all its member features from the map.
 * This is undoable via the snapshot journal.
 */
export function deleteGroupWithElements(id: string): void {
    const groupStore = useGroupStore(pinia);
    const mapStore = useMapStore(pinia);

    const group = groupStore.groups.find((g) => g.id === id);
    if (!group) {
        return;
    }
    const members = getGroupVersions(group).flatMap((version) => version.members);

    // Restore visibility for any hidden members before removing them.
    for (const member of members) {
        const marker = findMarkerByHistoryId(member.layerId, member.historyId);
        if (marker) {
            groupVisibilityController.reveal(marker);
        }
    }

    // Remove each member feature from its layer.
    const seen = new Set<string>();
    for (const member of members) {
        const key = featureKey(member.layerId, member.historyId);
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);

        const marker = findMarkerByHistoryId(member.layerId, member.historyId);
        const layerDef = mapStore.layers.find((l) => l.id === member.layerId);
        if (marker && layerDef) {
            layerDef.getLayer().removeLayer(marker as L.Layer);
        }
    }

    groupStore.removeGroup(id);
    // Clear any lingering highlights from having selected this group.
    clearFeatureHighlight();
    mapStore.markLayerUpdated();
}

/**
 * Remove all members from a group (elements stay on the map).
 * Undoable via the snapshot journal.
 */
export function removeAllGroupElements(id: string): void {
    const groupStore = useGroupStore(pinia);
    const mapStore = useMapStore(pinia);
    groupStore.clearGroupMembers(id);
    // Clear any lingering highlights from having selected this group.
    clearFeatureHighlight();
    // Members removed from the group may no longer be hidden by any group.
    recomputeFeatureVisibility();
    mapStore.markLayerUpdated();
}

/**
 * Delete a group WITHOUT deleting its member features (the elements remain on
 * the map, just ungrouped). Undoable. Used both for the "delete group only"
 * choice and after removeAllGroupElements when the user confirms deletion of a
 * now-empty group.
 */
export function deleteGroup(id: string): void {
    const groupStore = useGroupStore(pinia);
    const mapStore = useMapStore(pinia);
    groupStore.removeGroup(id);
    // Clear any lingering highlights from having selected this group so its
    // (now ungrouped) elements are not left looking selected.
    clearFeatureHighlight();
    // Removing the group may leave formerly-hidden members visible again.
    recomputeFeatureVisibility();
    mapStore.markLayerUpdated();
}

/**
 * Prune group members whose underlying feature no longer exists on the map
 * (e.g. deleted via area-select, popup delete, or an individual marker click).
 *
 * Returns true if any member was removed. Called from the save pipeline and on
 * map load so groups do not retain dangling references. Because it runs before
 * the snapshot checkpoint is taken, the prune is folded into the same undo step
 * as the deletion that caused it, keeping undo/redo consistent.
 */
export function pruneDanglingGroupMembers(): boolean {
    const groupStore = useGroupStore(pinia);
    const mapStore = useMapStore(pinia);

    if (groupStore.groups.length === 0) {
        return false;
    }

    // Build the set of (layerId:historyId) keys that currently exist.
    const existing = new Set<string>();
    for (const layer of mapStore.layers) {
        layer.getLayer().eachLayer((m) => {
            const historyId = getFeatureHistoryId(m);
            if (historyId) {
                existing.add(featureKey(layer.id, historyId));
            }
        });
    }

    let changed = false;
    const nextGroups = groupStore.groups.map((group) => {
        const versions = getGroupVersions(group).map((version) => ({
            ...version,
            members: version.members.filter((member) =>
                existing.has(featureKey(member.layerId, member.historyId))
            )
        }));
        const kept =
            versions.find((version) => version.id === groupStore.activeVersionIds[group.id])
                ?.members ??
            versions.find((version) => version.id === group.defaultVersionId)?.members ??
            versions[0]?.members ??
            [];
        const currentMembers = getActiveVersion(
            group,
            groupStore.activeVersionIds[group.id]
        ).members;
        if (
            kept.length !== currentMembers.length ||
            versions.some(
                (version, index) =>
                    version.members.length !== getGroupVersions(group)[index].members.length
            )
        ) {
            changed = true;
            return { ...group, versions, members: kept };
        }
        return group;
    });

    if (changed) {
        groupStore.setGroups(nextGroups, true);
    }
    return changed;
}
