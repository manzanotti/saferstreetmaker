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
import { useSettingsStore } from '../stores/settingsStore';
import {
    featureKey,
    getActiveVersion,
    getNewPhaseDraftMembers,
    getGroupVersions,
    needsReadOnlyGroupDetails
} from '../features/groups/groupVersions';
import { GroupVersionFeatureCloner } from '../features/groups/GroupVersionFeatureCloner';
import { pinia } from '../stores/index';
import {
    buildHistoryId,
    findLayerFeatureByHistoryId,
    getFeatureHistoryId,
    removeMapCursor,
    setMapCursor
} from './layers/layerUtils';
import {
    buildFeatureSelectionEntries,
    applySelectionHighlights,
    clearFeatureHighlight
} from './useAreaSelection';
import type { GroupMember } from '../models/Group';
import type { SelectedMarker } from '../stores/selectionStore';
import type { GroupPhase } from '../models/Group';
import { GroupVisibilityController } from '../features/groups/GroupVisibilityController';
import { analyzeSelectionMembership } from '../features/groups/groupMembership';
import { GroupPolylineSplitter } from '../features/groups/GroupPolylineSplitter';
import { normalizeGroupColour } from '../features/groups/groupColours';
import { GroupLtnFillController } from '../features/groups/GroupLtnFillController';
import { PhaseHighlighter } from '../features/groups/PhaseHighlighter';
import {
    PhasePlaybackController,
    type PhasePlaybackUpdate
} from '../features/groups/PhasePlaybackController';
import { useGroupPhaseEditing } from './groups/useGroupPhaseEditing';
import { createGroupMutations } from '../features/groups/groupMutations';

function findMarkerByHistoryId(layerId: string, historyId: string): L.Layer | null {
    return findLayerFeatureByHistoryId(useMapStore(pinia).layers, layerId, historyId);
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

const phaseHighlighter = new PhaseHighlighter((member) =>
    findMarkerByHistoryId(member.layerId, member.historyId)
);
let phasePlayback: PhasePlaybackController | null = null;

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

function clonePhases(phases: GroupPhase[]): GroupPhase[] {
    return phases.map((phase) => ({
        id: phase.id,
        members: phase.members.map((member) => ({ ...member }))
    }));
}

function markPhaseMutation(
    groupId: string,
    versionId: string,
    phaseId: string | null,
    before: GroupPhase[],
    after: GroupPhase[]
): void {
    useMapStore(pinia).markLayerUpdated({
        kind: 'phase-update',
        layerId: 'groups',
        payload: {
            groupId,
            versionId,
            phaseId,
            before: clonePhases(before),
            after: clonePhases(after)
        }
    });
}

export function recomputeFeatureVisibility(): void {
    groupVisibilityController.recompute();
    groupLtnFillController.recompute();
}

export function resetGroupVisibility(): void {
    groupVisibilityController.reset();
}

export function clearGroupSelection(): void {
    const selectionStore = useSelectionStore(pinia);
    applySelectionHighlights([], true, selectionStore.selected);
    selectionStore.deactivate();
    removeMapCursor('group-edit');
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
        nextMembers.map((member) => featureKey(member.layerId, member.historyId))
    );
    const removedMemberKeys = new Set(
        activeVersion.members
            .filter((member) => !nextMemberKeys.has(featureKey(member.layerId, member.historyId)))
            .map((member) => featureKey(member.layerId, member.historyId))
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
            if (!removedMemberKeys.has(featureKey(member.layerId, member.historyId))) {
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
export function selectGroup(id: string, highlightFeatures = true): void {
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

    if (highlightFeatures) {
        applySelectionHighlights(allEntries, true, previousEntries);
    }
}

export function fitGroupFeatures(bottomPadding: number): boolean {
    const groupStore = useGroupStore(pinia);
    const group = groupStore.detailsGroupId
        ? groupStore.groups.find((item) => item.id === groupStore.detailsGroupId)
        : null;
    const version = group ? getActiveVersion(group, groupStore.activeVersionIds[group.id]) : null;
    const map = useMapStore(pinia).map;
    if (!version || !map) {
        return false;
    }
    const entries = buildEntriesForMembers(version.members);
    if (entries.length === 0) {
        return false;
    }
    try {
        map.fitBounds(L.latLngBounds(entries.map((entry) => entry.latLng)), {
            paddingTopLeft: [40, 40],
            paddingBottomRight: [40, Math.max(40, bottomPadding + 24)],
            animate: false
        });
        return true;
    } catch {
        return false;
    }
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

function buildEntriesForMembers(members: GroupMember[]): SelectedMarker[] {
    const entries: SelectedMarker[] = [];
    for (const member of members) {
        const marker = findMarkerByHistoryId(member.layerId, member.historyId);
        if (marker) {
            entries.push(...buildFeatureSelectionEntries(marker, member.layerId));
        }
    }
    return entries;
}

function buildAllFeatureMembers(): GroupMember[] {
    const members: GroupMember[] = [];
    for (const layer of useMapStore(pinia).layers) {
        layer.getLayer().eachLayer((marker) => {
            const historyId = getFeatureHistoryId(marker);
            if (historyId) {
                members.push({ layerId: layer.id, historyId });
            }
        });
    }
    return members;
}

export function applyReadOnlyGroupPresentation(version: ReturnType<typeof getActiveVersion>): void {
    const members = buildAllFeatureMembers();
    const groupKeys = new Set(
        version.members.map((member) => featureKey(member.layerId, member.historyId))
    );
    phaseHighlighter.dimOutside(members, groupKeys);
}

export function clearReadOnlyGroupPresentation(): void {
    phaseHighlighter.clear(buildAllFeatureMembers());
}

export function clearReadOnlyEditingState(): void {
    for (const layer of useMapStore(pinia).layers) {
        if (layer.kind !== 'polyline' && layer.kind !== 'polygon') {
            continue;
        }
        layer.getLayer().eachLayer((feature: any) => feature.editing?.disable?.());
    }
    clearFeatureHighlight();
    useSelectionStore(pinia).deactivate();
    useMapStore(pinia).setDrawLayer(null);
}

export function focusReadOnlyGroupPhase(phaseId: string | null): boolean {
    const groupStore = useGroupStore(pinia);
    const group = groupStore.phaseGroupId
        ? groupStore.groups.find((item) => item.id === groupStore.phaseGroupId)
        : null;
    const version =
        group && groupStore.phaseVersionId
            ? getGroupVersions(group).find((item) => item.id === groupStore.phaseVersionId)
            : null;
    const phase = version?.phases?.find((item) => item.id === phaseId);
    if (!group || !version || !phase || !useSettingsStore(pinia).readOnly) {
        return false;
    }
    stopReadOnlyGroupPlayback();
    const selectionStore = useSelectionStore(pinia);
    applySelectionHighlights([], true, selectionStore.selected);
    selectionStore.setSelected([]);
    selectionStore.markGroupSelection(group.id);
    selectionStore.setPhaseEditing(false);
    groupStore.setFocusedPhase(phaseId);
    phaseHighlighter.dim(
        version.members,
        new Set(phase.members.map((member) => featureKey(member.layerId, member.historyId)))
    );
    return true;
}

export function stepReadOnlyGroupPhase(offset: number): boolean {
    const groupStore = useGroupStore(pinia);
    const group = groupStore.phaseGroupId
        ? groupStore.groups.find((item) => item.id === groupStore.phaseGroupId)
        : null;
    const phases =
        group && groupStore.phaseVersionId
            ? (getGroupVersions(group).find((item) => item.id === groupStore.phaseVersionId)
                  ?.phases ?? [])
            : [];
    const currentIndex = phases.findIndex((phase) => phase.id === groupStore.focusedPhaseId);
    const nextIndex =
        currentIndex < 0 ? (offset < 0 ? phases.length - 1 : 0) : currentIndex + offset;
    return Boolean(phases[nextIndex] && focusReadOnlyGroupPhase(phases[nextIndex].id));
}

export function startReadOnlyGroupPlayback(): boolean {
    const groupStore = useGroupStore(pinia);
    const group = groupStore.phaseGroupId
        ? groupStore.groups.find((item) => item.id === groupStore.phaseGroupId)
        : null;
    const version =
        group && groupStore.phaseVersionId
            ? getGroupVersions(group).find((item) => item.id === groupStore.phaseVersionId)
            : null;
    if (!group || !version?.phases?.length || !useSettingsStore(pinia).readOnly) {
        return false;
    }
    const phases = version.phases;
    stopReadOnlyGroupPlayback();
    groupStore.setFocusedPhase(null);
    groupStore.playbackPlaying = true;
    groupStore.playbackComplete = false;
    phasePlayback = new PhasePlaybackController(
        phases.length,
        ({ completedPhases, currentPhase, progress }: PhasePlaybackUpdate) => {
            groupStore.playbackPhaseIndex = currentPhase;
            const completed = new Set(
                phases
                    .slice(0, completedPhases)
                    .flatMap((phase) =>
                        phase.members.map((member) => featureKey(member.layerId, member.historyId))
                    )
            );
            const current =
                currentPhase === null
                    ? new Set<string>()
                    : new Set(
                          phases[currentPhase].members.map((member) =>
                              featureKey(member.layerId, member.historyId)
                          )
                      );
            applyReadOnlyPhasePresentation(
                version,
                new Set([...completed, ...current]),
                currentPhase === null ? 1 : progress,
                completed
            );
        },
        () => {
            groupStore.playbackPlaying = false;
            groupStore.playbackComplete = true;
            groupStore.playbackPhaseIndex = null;
        }
    );
    phasePlayback.start();
    return true;
}

function applyReadOnlyPhasePresentation(
    version: ReturnType<typeof getActiveVersion>,
    revealedMemberKeys: Set<string>,
    progress: number,
    completedMemberKeys = new Set<string>()
): void {
    const groupKeys = new Set(
        version.members.map((member) => featureKey(member.layerId, member.historyId))
    );
    phaseHighlighter.setProgress(
        buildAllFeatureMembers(),
        revealedMemberKeys,
        progress,
        completedMemberKeys,
        new Set(),
        groupKeys,
        0.12,
        0.28
    );
}

export function stopReadOnlyGroupPlayback(): void {
    phasePlayback?.stop();
    phasePlayback = null;
    const groupStore = useGroupStore(pinia);
    groupStore.playbackPlaying = false;
    groupStore.playbackPhaseIndex = null;
}

export function fitGroupPhaseFeatures(bottomPadding: number): boolean {
    const groupStore = useGroupStore(pinia);
    const group = groupStore.phaseGroupId
        ? groupStore.groups.find((item) => item.id === groupStore.phaseGroupId)
        : null;
    const version =
        group && groupStore.phaseVersionId
            ? getGroupVersions(group).find((item) => item.id === groupStore.phaseVersionId)
            : null;
    const map = useMapStore(pinia).map;
    if (!version || !map) {
        return false;
    }
    const entries = buildEntriesForMembers(version.members);
    if (entries.length === 0) {
        return false;
    }
    try {
        map.fitBounds(L.latLngBounds(entries.map((entry) => entry.latLng)), {
            paddingTopLeft: [40, 40],
            paddingBottomRight: [40, Math.max(40, bottomPadding + 24)],
            animate: false
        });
        return true;
    } catch {
        return false;
    }
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
