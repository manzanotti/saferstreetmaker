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
    hasVersionName,
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
import { applyPhaseSelectionDelta } from '../features/groups/phaseMembership';

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
let previousPhaseSelectionKeys = new Set<string>();
let phasePlayback: PhasePlaybackController | null = null;

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

function phaseMemberKeys(version: ReturnType<typeof getActiveVersion>): Set<string> {
    return new Set(
        (version.phases ?? []).flatMap((phase) =>
            phase.members.map((member) => featureKey(member.layerId, member.historyId))
        )
    );
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

export function openGroupPhases(groupId: string, versionId: string): boolean {
    if (useSettingsStore(pinia).readOnly) {
        return false;
    }
    const groupStore = useGroupStore(pinia);
    const group = groupStore.groups.find((item) => item.id === groupId);
    const version = group ? getGroupVersions(group).find((item) => item.id === versionId) : null;
    if (!group || !version) {
        return false;
    }

    const selectionStore = useSelectionStore(pinia);
    const uiStore = useUiStore(pinia);
    const mapStore = useMapStore(pinia);
    groupStore.closeDetailsDialog();
    removeMapCursor('group-edit');
    applySelectionHighlights([], true, selectionStore.selected);
    selectionStore.deactivate();
    if (groupStore.activeVersionIds[groupId] !== versionId) {
        groupStore.setActiveVersion(groupId, versionId);
        recomputeFeatureVisibility();
        mapStore.markLayerUpdated();
    }
    groupStore.openPhasesDialog(groupId, versionId);
    uiStore.closePanel();
    if (version.phases && version.phases.length > 0) {
        phaseHighlighter.clear(version.members);
        focusGroupPhase(version.phases[0].id);
    } else {
        startNewGroupPhase();
    }
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

export function refreshGroupPhasePresentation(): void {
    const groupStore = useGroupStore(pinia);
    const selectionStore = useSelectionStore(pinia);
    const group = groupStore.phaseGroupId
        ? groupStore.groups.find((item) => item.id === groupStore.phaseGroupId)
        : null;
    const version =
        group && groupStore.phaseVersionId
            ? getGroupVersions(group).find((item) => item.id === groupStore.phaseVersionId)
            : null;
    if (!version || !groupStore.phaseDraftActive || useSettingsStore(pinia).readOnly) {
        return;
    }
    const versionMemberKeys = new Set(
        version.members.map((member) => featureKey(member.layerId, member.historyId))
    );
    const selectedVersionEntries = selectionStore.selected.filter(
        (entry) =>
            entry.historyId !== null &&
            versionMemberKeys.has(featureKey(entry.layerId, entry.historyId))
    );
    const selectedKeys = new Set(
        selectedVersionEntries.map((entry) => featureKey(entry.layerId, entry.historyId!))
    );
    const editingId = groupStore.phaseEditingId;
    if (editingId) {
        const selectedMembers = Array.from(
            new Map(
                selectedVersionEntries
                    .filter(
                        (entry): entry is SelectedMarker & { historyId: string } =>
                            entry.historyId !== null
                    )
                    .map((entry) => [
                        featureKey(entry.layerId, entry.historyId),
                        { layerId: entry.layerId, historyId: entry.historyId }
                    ])
            ).values()
        );
        const addedKeys = new Set(
            Array.from(selectedKeys).filter((key) => !previousPhaseSelectionKeys.has(key))
        );
        const phases = (version.phases ?? []).map((phase) => ({
            ...phase,
            members:
                phase.id === editingId
                    ? applyPhaseSelectionDelta(
                          phase.members,
                          selectedMembers,
                          previousPhaseSelectionKeys
                      )
                    : phase.members.filter(
                          (member) => !addedKeys.has(featureKey(member.layerId, member.historyId))
                      )
        }));
        const editedPhase = phases.find((phase) => phase.id === editingId);
        const changed = phases.some((phase, index) => {
            const previousMembers = version.phases?.[index]?.members ?? [];
            return (
                phase.members.length !== previousMembers.length ||
                phase.members.some(
                    (member, memberIndex) =>
                        featureKey(member.layerId, member.historyId) !==
                        featureKey(
                            previousMembers[memberIndex]?.layerId ?? '',
                            previousMembers[memberIndex]?.historyId ?? ''
                        )
                )
            );
        });
        groupStore.pendingEmptyPhaseDeletionId = editedPhase?.members.length ? null : editingId;
        if (
            changed &&
            groupStore.phaseGroupId &&
            groupStore.phaseVersionId &&
            groupStore.replaceVersionPhases(
                groupStore.phaseGroupId,
                groupStore.phaseVersionId,
                phases
            )
        ) {
            markPhaseMutation(
                groupStore.phaseGroupId,
                groupStore.phaseVersionId,
                editingId,
                version.phases ?? [],
                phases
            );
        }
    }
    previousPhaseSelectionKeys = selectedKeys;
    phaseHighlighter.dim(version.members, selectedKeys);
}

export function focusGroupPhase(phaseId: string | null): boolean {
    const groupStore = useGroupStore(pinia);
    const group = groupStore.phaseGroupId
        ? groupStore.groups.find((item) => item.id === groupStore.phaseGroupId)
        : null;
    const version =
        group && groupStore.phaseVersionId
            ? getGroupVersions(group).find((item) => item.id === groupStore.phaseVersionId)
            : null;
    const phase = version?.phases?.find((item) => item.id === phaseId);
    if (!group || !version || !phase) {
        return false;
    }
    const selectionStore = useSelectionStore(pinia);
    const previousEntries = selectionStore.selected;
    const entries = buildEntriesForMembers(phase.members);
    groupStore.phaseDraftActive = false;
    selectionStore.setSelected(entries);
    selectionStore.markGroupSelection(group.id);
    selectionStore.setPhaseEditing(true);
    applySelectionHighlights(entries, true, previousEntries);
    previousPhaseSelectionKeys = new Set(
        entries.map((entry) => featureKey(entry.layerId, entry.historyId ?? ''))
    );
    groupStore.phaseDraftActive = true;
    groupStore.phaseEditingId = phaseId;
    groupStore.pendingEmptyPhaseDeletionId = null;
    groupStore.setFocusedPhase(phaseId);
    phaseHighlighter.dim(
        version.members,
        new Set(phase.members.map((member) => featureKey(member.layerId, member.historyId)))
    );
    return true;
}

function finishGroupPhaseEditing(): void {
    const groupStore = useGroupStore(pinia);
    const selectionStore = useSelectionStore(pinia);
    const group = groupStore.phaseGroupId
        ? groupStore.groups.find((item) => item.id === groupStore.phaseGroupId)
        : null;
    const version =
        group && groupStore.phaseVersionId
            ? getGroupVersions(group).find((item) => item.id === groupStore.phaseVersionId)
            : null;
    if (version) {
        phaseHighlighter.clear(version.members);
    }
    applySelectionHighlights([], true, selectionStore.selected);
    selectionStore.deactivate();
    previousPhaseSelectionKeys = new Set<string>();
    groupStore.phaseDraftActive = false;
    groupStore.phaseEditingId = null;
    groupStore.pendingEmptyPhaseDeletionId = null;
    groupStore.setFocusedPhase(null);
}

export function confirmEmptyGroupPhaseDeletion(deletePhase: boolean): boolean {
    if (useSettingsStore(pinia).readOnly) {
        return false;
    }
    const groupStore = useGroupStore(pinia);
    const groupId = groupStore.phaseGroupId;
    const versionId = groupStore.phaseVersionId;
    const phaseId = groupStore.pendingEmptyPhaseDeletionId;
    if (!deletePhase) {
        groupStore.pendingEmptyPhaseDeletionId = null;
        return false;
    }
    const group = groupId ? groupStore.groups.find((item) => item.id === groupId) : null;
    const version =
        group && versionId ? getGroupVersions(group).find((item) => item.id === versionId) : null;
    if (!groupId || !versionId || !phaseId || !version) {
        return false;
    }
    const before = version.phases ?? [];
    const after = before.filter((phase) => phase.id !== phaseId);
    if (!groupStore.replaceVersionPhases(groupId, versionId, after)) {
        return false;
    }
    markPhaseMutation(groupId, versionId, phaseId, before, after);
    finishGroupPhaseEditing();
    return true;
}

export function reorderGroupPhases(phaseIds: string[]): boolean {
    if (useSettingsStore(pinia).readOnly) {
        return false;
    }
    const groupStore = useGroupStore(pinia);
    const groupId = groupStore.phaseGroupId;
    const versionId = groupStore.phaseVersionId;
    if (!groupId || !versionId) {
        return false;
    }
    const group = groupStore.groups.find((item) => item.id === groupId);
    const version = group ? getGroupVersions(group).find((item) => item.id === versionId) : null;
    const before = version?.phases ?? [];
    const reordered = groupStore.reorderVersionPhases(groupId, versionId, phaseIds);
    if (reordered) {
        const updatedGroup = groupStore.groups.find((item) => item.id === groupId);
        const updatedVersion = updatedGroup
            ? getGroupVersions(updatedGroup).find((item) => item.id === versionId)
            : null;
        markPhaseMutation(
            groupId,
            versionId,
            groupStore.phaseEditingId,
            before,
            updatedVersion?.phases ?? []
        );
    }
    return reordered;
}

export function closeGroupPhases(): void {
    stopReadOnlyGroupPlayback();
    const groupStore = useGroupStore(pinia);
    const selectionStore = useSelectionStore(pinia);
    const group = groupStore.phaseGroupId
        ? groupStore.groups.find((item) => item.id === groupStore.phaseGroupId)
        : null;
    const version =
        group && groupStore.phaseVersionId
            ? getGroupVersions(group).find((item) => item.id === groupStore.phaseVersionId)
            : null;
    if (version) {
        phaseHighlighter.clear(version.members);
    }
    applySelectionHighlights([], true, selectionStore.selected);
    selectionStore.deactivate();
    removeMapCursor('group-edit');
    groupStore.closePhasesDialog();
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
    const detailsOpen = groupStore.detailsGroupId === groupId;
    if (detailsOpen) {
        groupStore.closeDetailsDialog();
    }
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
                    remainingVersion.members.map((member) =>
                        featureKey(member.layerId, member.historyId)
                    )
                )
            )
        );
        for (const member of version.members) {
            if (remainingMembers.has(featureKey(member.layerId, member.historyId))) {
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
