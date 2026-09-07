import * as L from 'leaflet';
import { useMapStore } from '../../stores/mapStore';
import { useSelectionStore } from '../../stores/selectionStore';
import { useGroupStore } from '../../stores/groupStore';
import { useUiStore } from '../../stores/uiStore';
import { useSettingsStore } from '../../stores/settingsStore';
import {
    featureKey,
    getGroupVersions,
    getNewPhaseDraftMembers
} from '../../features/groups/groupVersions';
import { pinia } from '../../stores/index';
import { buildHistoryId, removeMapCursor } from '../layers/layerUtils';
import { applySelectionHighlights } from '../useAreaSelection';
import { applyPhaseSelectionDelta } from '../../features/groups/phaseMembership';
import {
    PhasePlaybackController,
    type PhasePlaybackUpdate
} from '../../features/groups/PhasePlaybackController';
import type { SelectedMarker } from '../../stores/selectionStore';
import { recomputeFeatureVisibility } from './useGroupVisibility';
import { applyReadOnlyPhasePresentation } from './useGroupReadOnlyPresentation';
import {
    buildEntriesForMembers,
    markPhaseMutation,
    phaseHighlighter,
    phaseState
} from './groupsShared';

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
    phaseState.phasePlayback = new PhasePlaybackController(
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
    phaseState.phasePlayback.start();
    return true;
}

export function stopReadOnlyGroupPlayback(): void {
    phaseState.phasePlayback?.stop();
    phaseState.phasePlayback = null;
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
            Array.from(selectedKeys).filter(
                (key) => !phaseState.previousPhaseSelectionKeys.has(key)
            )
        );
        const phases = (version.phases ?? []).map((phase) => ({
            ...phase,
            members:
                phase.id === editingId
                    ? applyPhaseSelectionDelta(
                          phase.members,
                          selectedMembers,
                          phaseState.previousPhaseSelectionKeys
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
    phaseState.previousPhaseSelectionKeys = selectedKeys;
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
    phaseState.previousPhaseSelectionKeys = new Set(
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
    phaseState.previousPhaseSelectionKeys = new Set<string>();
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
