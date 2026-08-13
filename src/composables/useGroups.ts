/**
 * useGroups.ts
 *
 * Core group logic — exported as plain functions that read from the shared
 * Pinia singleton, following the same pattern as useAreaSelection.ts.
 *
 * Group visibility is runtime-only (not persisted, not undoable). All other
 * mutations (create, rename, remove-members, delete-with-elements) call
 * mapStore.markLayerUpdated() so the snapshot journal creates a checkpoint.
 *
 * Multi-group visibility rule: a feature is hidden only when EVERY group it
 * belongs to is hidden; showing any one of its groups reveals it.
 */
import * as L from 'leaflet';
import { useMapStore } from '../stores/mapStore';
import { useSelectionStore } from '../stores/selectionStore';
import { useGroupStore } from '../stores/groupStore';
import { useUiStore } from '../stores/uiStore';
import {
    getActiveVersion,
    getGroupVersions,
    hasVersionName
} from '../features/groups/groupVersions';
import { GroupVersionFeatureCloner } from '../features/groups/GroupVersionFeatureCloner';
import { pinia } from '../stores/index';
import { buildHistoryId, getFeatureHistoryId } from './layers/layerUtils';
import {
    buildFeatureSelectionEntries,
    applySelectionHighlights,
    clearFeatureHighlight
} from './useAreaSelection';
import type { GroupMember } from '../models/Group';
import type { SelectedMarker } from '../stores/selectionStore';
import { GroupVisibilityController } from '../features/groups/GroupVisibilityController';
import { analyzeSelectionMembership } from '../features/groups/groupMembership';
import { GroupPolylineSplitter } from '../features/groups/GroupPolylineSplitter';
import { normalizeGroupColour } from '../features/groups/groupColours';
import { GroupLtnFillController } from '../features/groups/GroupLtnFillController';

function findMarkerByHistoryId(layerId: string, historyId: string): L.Layer | null {
    const mapStore = useMapStore(pinia);
    const layerDef = mapStore.layers.find((l) => l.id === layerId);
    if (!layerDef) {
        return null;
    }
    let found: L.Layer | null = null;
    layerDef.getLayer().eachLayer((m) => {
        if (getFeatureHistoryId(m) === historyId) {
            found = m as L.Layer;
        }
    });
    return found;
}

const groupVisibilityController = new GroupVisibilityController({
    getGroups: () => useGroupStore(pinia).groups,
    getHiddenGroupIds: () => useGroupStore(pinia).hiddenGroupIds,
    getActiveVersionIds: () => useGroupStore(pinia).activeVersionIds,
    findMarker: (member) => findMarkerByHistoryId(member.layerId, member.historyId)
});

const groupLtnFillController = new GroupLtnFillController({
    getGroups: () => useGroupStore(pinia).groups,
    getHiddenGroupIds: () => useGroupStore(pinia).hiddenGroupIds,
    getActiveVersionIds: () => useGroupStore(pinia).activeVersionIds,
    getLayer: () =>
        (useMapStore(pinia)
            .layers.find((layer) => layer.id === 'LtnCells')
            ?.getLayer() as L.LayerGroup | undefined) ?? null
});

const groupPolylineSplitter = new GroupPolylineSplitter({
    getLayer: (layerId) => useMapStore(pinia).layers.find((layer) => layer.id === layerId),
    createHistoryId: () => buildHistoryId('polyline')
});

export function recomputeFeatureVisibility(): void {
    groupVisibilityController.recompute();
    groupLtnFillController.recompute();
}

export function resetGroupVisibility(): void {
    groupVisibilityController.reset();
}

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

// ── Selection → membership helpers ───────────────────────────────────────

/**
 * Analyse the current selection, detect partially-selected polylines, and
 * open the appropriate dialog.
 * Called when the user clicks the "Group" button in AreaSelectionPanel.
 */
function getSelectionMembership() {
    const selectionStore = useSelectionStore(pinia);
    const mapStore = useMapStore(pinia);
    return analyzeSelectionMembership(
        selectionStore.selected,
        mapStore.layers,
        selectionStore.lastAreaBounds
    );
}

function splitRemovedSharedVersionMembers(groupId: string, nextMembers: GroupMember[]): void {
    const groupStore = useGroupStore(pinia);
    const mapStore = useMapStore(pinia);
    const group = groupStore.groups.find((item) => item.id === groupId);
    const activeVersion = groupStore.getActiveGroupVersion(groupId);
    if (!group || !activeVersion) {
        return;
    }

    const nextMemberKeys = new Set(
        nextMembers.map((member) => `${member.layerId}:${member.historyId}`)
    );
    const removedMemberKeys = new Set(
        activeVersion.members
            .filter((member) => !nextMemberKeys.has(`${member.layerId}:${member.historyId}`))
            .map((member) => `${member.layerId}:${member.historyId}`)
    );
    if (removedMemberKeys.size === 0) {
        return;
    }

    const cloner = new GroupVersionFeatureCloner({
        getLayer: (layerId) => mapStore.layers.find((layer) => layer.id === layerId),
        findFeature: (layer, historyId) => {
            let found: any = null;
            layer.getLayer().eachLayer((item: any) => {
                if (getFeatureHistoryId(item) === historyId) {
                    found = item.feature ?? item.toGeoJSON?.() ?? null;
                }
            });
            return found;
        }
    });

    for (const version of getGroupVersions(group)) {
        if (version.id === activeVersion.id) {
            continue;
        }
        for (const member of version.members) {
            if (!removedMemberKeys.has(`${member.layerId}:${member.historyId}`)) {
                continue;
            }
            const clonedMember = cloner.clone({ ...version, members: [member] }).members[0];
            if (clonedMember) {
                groupStore.replaceVersionMember(groupId, version.id, member, clonedMember);
            }
        }
    }
}

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
    selectionStore.deactivate();
    mapStore.markLayerUpdated();

    if (membership.fullMembers.length === 0) {
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
 * Perform the pending polyline splits. Called by finalizeCreateGroup so the
 * geometry mutation and the resulting group creation land in a single
 * markLayerUpdated() checkpoint. Deferring the split until the group is
 * confirmed means cancelling the name dialog leaves the map untouched.
 *
 * Returns the GroupMember entries for the newly-created split lines.
 */
function performPendingSplits(): GroupMember[] {
    const groupStore = useGroupStore(pinia);
    return groupPolylineSplitter.split([...groupStore.pendingSplits]);
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

/**
 * Select all members of a group and fit the map to show them all.
 */
export function selectGroup(id: string): void {
    const groupStore = useGroupStore(pinia);
    const mapStore = useMapStore(pinia);
    const selectionStore = useSelectionStore(pinia);

    const group = groupStore.groups.find((g) => g.id === id);
    const members = group ? getActiveVersion(group, groupStore.activeVersionIds[id]).members : [];
    if (!group || members.length === 0) {
        return;
    }

    // Build SelectedMarker entries for every member, handling both point
    // markers (getLatLng) and polyline/polygon features (getLatLngs).
    const allEntries: SelectedMarker[] = [];

    for (const member of members) {
        const marker = findMarkerByHistoryId(member.layerId, member.historyId);
        if (!marker) {
            continue;
        }

        const isPoint = typeof (marker as any).getLatLng === 'function';
        if (isPoint) {
            // Point marker — create a single entry using getLatLng().
            const latLng = (marker as any).getLatLng() as L.LatLng;
            allEntries.push({
                layerId: member.layerId,
                historyId: member.historyId,
                latLng,
                marker
            });
        } else {
            // Polyline / polygon — one entry per vertex.
            const entries = buildFeatureSelectionEntries(marker, member.layerId);
            allEntries.push(...entries);
        }
    }

    if (allEntries.length === 0) {
        return;
    }

    // Track the group's members as the current selection and highlight them,
    // but do NOT enter area-selection mode. Selecting a group should only
    // reveal it; if the user wants to add to the group they can activate the
    // selection tool themselves.
    const previousEntries = selectionStore.selected;
    selectionStore.setSelected(allEntries);
    selectionStore.markGroupSelection(id);

    // Fit the map to the bounds of all selected features BEFORE applying
    // highlights. fitBounds can pan/zoom the map and recreate DivIcon marker
    // DOM elements, which would drop the CSS highlight class from point
    // markers. Applying highlights afterwards (with a non-animated fit) keeps
    // point, polygon and polyline highlights all in sync.
    const map = mapStore.map;
    if (map) {
        try {
            const bounds = L.latLngBounds(allEntries.map((e) => e.latLng));
            map.fitBounds(bounds, { padding: [50, 50], animate: false });
        } catch {
            // latLngBounds can throw if all points coincide — safe to ignore.
        }
    }

    applySelectionHighlights(allEntries, true, previousEntries);
}

export function openGroupDetails(id: string): void {
    const groupStore = useGroupStore(pinia);
    const uiStore = useUiStore(pinia);
    selectGroup(id);
    groupStore.openDetailsDialog(id);
    uiStore.closePanel();
}

export function switchGroupVersion(groupId: string, versionId: string): boolean {
    const groupStore = useGroupStore(pinia);
    const mapStore = useMapStore(pinia);
    const selectionStore = useSelectionStore(pinia);
    const switched = groupStore.setActiveVersion(groupId, versionId);
    if (switched) {
        const previousSelection = selectionStore.selected;
        applySelectionHighlights([], true, previousSelection);
        selectionStore.setSelected([]);
        recomputeFeatureVisibility();
        selectGroup(groupId);
        groupLtnFillController.recompute();
        mapStore.markLayerUpdated();
    }
    return switched;
}

export function createGroupVersion(groupId: string, name: string): boolean {
    const groupStore = useGroupStore(pinia);
    const group = groupStore.groups.find((item) => item.id === groupId);
    const source = group ? groupStore.getActiveGroupVersion(groupId) : null;
    const mapStore = useMapStore(pinia);
    if (!group || !source || !name.trim() || hasVersionName(group, name)) {
        return false;
    }

    const cloner = new GroupVersionFeatureCloner({
        getLayer: (layerId) => mapStore.layers.find((layer) => layer.id === layerId),
        findFeature: (layer, historyId) => {
            let found: any = null;
            layer.getLayer().eachLayer((item: any) => {
                if (getFeatureHistoryId(item) === historyId) {
                    found = item.feature ?? item.toGeoJSON?.() ?? null;
                }
            });
            return found;
        }
    });
    const cloned = cloner.clone({ id: source.id, name: name.trim(), members: source.members });
    if (!groupStore.addVersion(groupId, cloned)) {
        return false;
    }
    mapStore.markLayerUpdated();
    return switchGroupVersion(groupId, cloned.id);
}

export function renameGroupVersion(groupId: string, versionId: string, name: string): boolean {
    const groupStore = useGroupStore(pinia);
    const mapStore = useMapStore(pinia);
    const renamed = groupStore.renameVersion(groupId, versionId, name);
    if (renamed) {
        mapStore.markLayerUpdated();
    }
    return renamed;
}

export function setGroupDefaultVersion(groupId: string, versionId: string): boolean {
    const groupStore = useGroupStore(pinia);
    const mapStore = useMapStore(pinia);
    const changed = groupStore.setDefaultVersion(groupId, versionId);
    if (changed) {
        mapStore.markLayerUpdated();
    }
    return changed;
}

export function deleteGroupVersion(
    groupId: string,
    versionId: string,
    deleteElements = false
): boolean {
    const groupStore = useGroupStore(pinia);
    const selectionStore = useSelectionStore(pinia);
    if (selectionStore.selectedGroupId === groupId) {
        clearFeatureHighlight();
    }
    const version = groupStore.removeVersion(groupId, versionId);
    if (!version) {
        return false;
    }
    const mapStore = useMapStore(pinia);
    if (deleteElements) {
        const remainingMembers = new Set(
            groupStore.groups.flatMap((group) =>
                getGroupVersions(group).flatMap((remainingVersion) =>
                    remainingVersion.members.map(
                        (member) => `${member.layerId}:${member.historyId}`
                    )
                )
            )
        );
        for (const member of version.members) {
            if (remainingMembers.has(`${member.layerId}:${member.historyId}`)) {
                continue;
            }
            const marker = findMarkerByHistoryId(member.layerId, member.historyId);
            const layer = mapStore.layers.find((item) => item.id === member.layerId);
            if (marker && layer) {
                layer.getLayer().removeLayer(marker);
            }
        }
    }
    mapStore.markLayerUpdated();
    recomputeFeatureVisibility();
    return true;
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
        const key = `${member.layerId}:${member.historyId}`;
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
 * Toggle a group's visibility. Runtime only — not persisted, not undoable.
 */
export function toggleGroupVisibility(id: string): void {
    const groupStore = useGroupStore(pinia);
    groupStore.toggleHidden(id);
    recomputeFeatureVisibility();
}

/**
 * Show or hide ALL groups at once. Runtime only — not undoable.
 */
export function setAllGroupsVisibility(hidden: boolean): void {
    const groupStore = useGroupStore(pinia);
    groupStore.setAllHidden(hidden);
    recomputeFeatureVisibility();
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
                existing.add(`${layer.id}:${historyId}`);
            }
        });
    }

    let changed = false;
    const nextGroups = groupStore.groups.map((group) => {
        const versions = getGroupVersions(group).map((version) => ({
            ...version,
            members: version.members.filter((member) =>
                existing.has(`${member.layerId}:${member.historyId}`)
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
