import type { GroupMember } from '../../models/Group';
import { useMapStore } from '../../stores/mapStore';
import { useSelectionStore } from '../../stores/selectionStore';
import { useGroupStore } from '../../stores/groupStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { pinia } from '../../stores/index';
import {
    featureKey,
    getActiveVersion,
    getGroupVersions,
    getUnassignedGroupMembers
} from '../../features/groups/groupVersions';
import {
    PhasePlaybackController,
    type PhasePlaybackUpdate
} from '../../features/groups/PhasePlaybackController';
import { getFeatureHistoryId } from '../layers/features/featureLookup';
import { applySelectionHighlights, clearFeatureHighlight } from '../useAreaSelection';
import { phaseHighlighter } from './groupRuntime';

let phasePlayback: PhasePlaybackController | null = null;

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
    const group = useGroupStore(pinia).groups.find((item) =>
        getGroupVersions(item).some((itemVersion) => itemVersion.id === version.id)
    );
    const groupKeys = new Set(
        [...version.members, ...(group ? getUnassignedGroupMembers(group) : [])].map((member) =>
            featureKey(member.layerId, member.historyId)
        )
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
