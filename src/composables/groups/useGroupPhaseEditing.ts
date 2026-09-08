import { useGroupStore } from '../../stores/groupStore';
import { useMapStore } from '../../stores/mapStore';
import { useSelectionStore, type SelectedMarker } from '../../stores/selectionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useUiStore } from '../../stores/uiStore';
import { pinia } from '../../stores/index';
import { featureKey, getGroupVersions } from '../../features/groups/groupVersions';
import { PhaseHighlighter } from '../../features/groups/PhaseHighlighter';
import { applyPhaseSelectionDelta } from '../../features/groups/phaseMembership';
import { applySelectionHighlights } from '../useAreaSelection';
import { removeMapCursor } from '../layers/layerUtils';
import type { GroupMember, GroupPhase } from '../../models/Group';

export interface GroupPhaseEditingContext {
    phaseHighlighter: PhaseHighlighter;
    buildEntriesForMembers: (members: GroupMember[]) => SelectedMarker[];
    markPhaseMutation: (
        groupId: string,
        versionId: string,
        phaseId: string | null,
        before: GroupPhase[],
        after: GroupPhase[]
    ) => void;
    recomputeFeatureVisibility: () => void;
    stopReadOnlyGroupPlayback: () => void;
    startNewGroupPhase: () => boolean;
}

export function useGroupPhaseEditing(context: GroupPhaseEditingContext) {
    let previousPhaseSelectionKeys = new Set<string>();

    function openGroupPhases(groupId: string, versionId: string): boolean {
        if (useSettingsStore(pinia).readOnly) {
            return false;
        }
        const groupStore = useGroupStore(pinia);
        const group = groupStore.groups.find((item) => item.id === groupId);
        const version = group
            ? getGroupVersions(group).find((item) => item.id === versionId)
            : null;
        if (!group || !version) {
            return false;
        }

        const selectionStore = useSelectionStore(pinia);
        groupStore.closeDetailsDialog();
        removeMapCursor('group-edit');
        applySelectionHighlights([], true, selectionStore.selected);
        selectionStore.deactivate();
        if (groupStore.activeVersionIds[groupId] !== versionId) {
            groupStore.setActiveVersion(groupId, versionId);
            context.recomputeFeatureVisibility();
            useMapStore(pinia).markLayerUpdated();
        }
        groupStore.openPhasesDialog(groupId, versionId);
        useUiStore(pinia).closePanel();
        if (version.phases && version.phases.length > 0) {
            context.phaseHighlighter.clear(version.members);
            focusGroupPhase(version.phases[0].id);
        } else {
            context.startNewGroupPhase();
        }
        return true;
    }

    function refreshGroupPhasePresentation(): void {
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
                              (member) =>
                                  !addedKeys.has(featureKey(member.layerId, member.historyId))
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
                context.markPhaseMutation(
                    groupStore.phaseGroupId,
                    groupStore.phaseVersionId,
                    editingId,
                    version.phases ?? [],
                    phases
                );
            }
        }
        previousPhaseSelectionKeys = selectedKeys;
        context.phaseHighlighter.dim(version.members, selectedKeys);
    }

    function focusGroupPhase(phaseId: string | null): boolean {
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
        const entries = context.buildEntriesForMembers(phase.members);
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
        context.phaseHighlighter.dim(
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
            context.phaseHighlighter.clear(version.members);
        }
        applySelectionHighlights([], true, selectionStore.selected);
        selectionStore.deactivate();
        previousPhaseSelectionKeys = new Set<string>();
        groupStore.phaseDraftActive = false;
        groupStore.phaseEditingId = null;
        groupStore.pendingEmptyPhaseDeletionId = null;
        groupStore.setFocusedPhase(null);
    }

    function confirmEmptyGroupPhaseDeletion(deletePhase: boolean): boolean {
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
            group && versionId
                ? getGroupVersions(group).find((item) => item.id === versionId)
                : null;
        if (!groupId || !versionId || !phaseId || !version) {
            return false;
        }
        const before = version.phases ?? [];
        const after = before.filter((phase) => phase.id !== phaseId);
        if (!groupStore.replaceVersionPhases(groupId, versionId, after)) {
            return false;
        }
        context.markPhaseMutation(groupId, versionId, phaseId, before, after);
        finishGroupPhaseEditing();
        return true;
    }

    function reorderGroupPhases(phaseIds: string[]): boolean {
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
        const version = group
            ? getGroupVersions(group).find((item) => item.id === versionId)
            : null;
        const before = version?.phases ?? [];
        const reordered = groupStore.reorderVersionPhases(groupId, versionId, phaseIds);
        if (reordered) {
            const updatedGroup = groupStore.groups.find((item) => item.id === groupId);
            const updatedVersion = updatedGroup
                ? getGroupVersions(updatedGroup).find((item) => item.id === versionId)
                : null;
            context.markPhaseMutation(
                groupId,
                versionId,
                groupStore.phaseEditingId,
                before,
                updatedVersion?.phases ?? []
            );
        }
        return reordered;
    }

    function closeGroupPhases(): void {
        context.stopReadOnlyGroupPlayback();
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
            context.phaseHighlighter.clear(version.members);
        }
        applySelectionHighlights([], true, selectionStore.selected);
        selectionStore.deactivate();
        removeMapCursor('group-edit');
        groupStore.closePhasesDialog();
    }

    return {
        openGroupPhases,
        refreshGroupPhasePresentation,
        focusGroupPhase,
        confirmEmptyGroupPhaseDeletion,
        reorderGroupPhases,
        closeGroupPhases
    };
}
