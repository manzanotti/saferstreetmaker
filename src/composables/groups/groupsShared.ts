import * as L from 'leaflet';
import { useMapStore } from '../../stores/mapStore';
import { useSelectionStore } from '../../stores/selectionStore';
import { useGroupStore } from '../../stores/groupStore';
import { featureKey, getGroupVersions } from '../../features/groups/groupVersions';
import { GroupVersionFeatureCloner } from '../../features/groups/GroupVersionFeatureCloner';
import { pinia } from '../../stores/index';
import {
    buildHistoryId,
    findLayerFeatureByHistoryId,
    getFeatureHistoryId
} from '../layers/layerUtils';
import { GroupVisibilityController } from '../../features/groups/GroupVisibilityController';
import { analyzeSelectionMembership } from '../../features/groups/groupMembership';
import { GroupPolylineSplitter } from '../../features/groups/GroupPolylineSplitter';
import { GroupLtnFillController } from '../../features/groups/GroupLtnFillController';
import { PhaseHighlighter } from '../../features/groups/PhaseHighlighter';
import { PhasePlaybackController } from '../../features/groups/PhasePlaybackController';
import { buildFeatureSelectionEntries } from '../useAreaSelection';
import type { GroupMember, GroupPhase } from '../../models/Group';
import type { SelectedMarker } from '../../stores/selectionStore';

export function findMarkerByHistoryId(layerId: string, historyId: string): L.Layer | null {
    return findLayerFeatureByHistoryId(useMapStore(pinia).layers, layerId, historyId);
}

export const groupVisibilityController = new GroupVisibilityController({
    getGroups: () => useGroupStore(pinia).groups,
    getHiddenGroupIds: () => useGroupStore(pinia).hiddenGroupIds,
    getActiveVersionIds: () => useGroupStore(pinia).activeVersionIds,
    findMarker: (member) => findMarkerByHistoryId(member.layerId, member.historyId)
});

export const groupLtnFillController = new GroupLtnFillController({
    getGroups: () => useGroupStore(pinia).groups,
    getHiddenGroupIds: () => useGroupStore(pinia).hiddenGroupIds,
    getActiveVersionIds: () => useGroupStore(pinia).activeVersionIds,
    getLayer: () =>
        (useMapStore(pinia)
            .layers.find((layer) => layer.id === 'LtnCells')
            ?.getLayer() as L.LayerGroup | undefined) ?? null
});

export const groupPolylineSplitter = new GroupPolylineSplitter({
    getLayer: (layerId) => useMapStore(pinia).layers.find((layer) => layer.id === layerId),
    createHistoryId: () => buildHistoryId('polyline')
});

export const phaseHighlighter = new PhaseHighlighter((member) =>
    findMarkerByHistoryId(member.layerId, member.historyId)
);

export const phaseState = {
    previousPhaseSelectionKeys: new Set<string>(),
    phasePlayback: null as PhasePlaybackController | null
};

export function clonePhases(phases: GroupPhase[]): GroupPhase[] {
    return phases.map((phase) => ({
        id: phase.id,
        members: phase.members.map((member) => ({ ...member }))
    }));
}

export function markPhaseMutation(
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

// ── Selection → membership helpers ───────────────────────────────────────

/**
 * Analyse the current selection, detect partially-selected polylines, and
 * open the appropriate dialog.
 * Called when the user clicks the "Group" button in AreaSelectionPanel.
 */

export function getSelectionMembership() {
    const selectionStore = useSelectionStore(pinia);
    const mapStore = useMapStore(pinia);
    return analyzeSelectionMembership(
        selectionStore.selected,
        mapStore.layers,
        selectionStore.lastAreaBounds
    );
}

export function splitRemovedSharedVersionMembers(
    groupId: string,
    nextMembers: GroupMember[]
): void {
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

/**
 * Perform the pending polyline splits. Called by finalizeCreateGroup so the
 * geometry mutation and the resulting group creation land in a single
 * markLayerUpdated() checkpoint. Deferring the split until the group is
 * confirmed means cancelling the name dialog leaves the map untouched.
 *
 * Returns the GroupMember entries for the newly-created split lines.
 */

export function performPendingSplits(): GroupMember[] {
    const groupStore = useGroupStore(pinia);
    return groupPolylineSplitter.split([...groupStore.pendingSplits]);
}

export function buildEntriesForMembers(members: GroupMember[]): SelectedMarker[] {
    const entries: SelectedMarker[] = [];
    for (const member of members) {
        const marker = findMarkerByHistoryId(member.layerId, member.historyId);
        if (marker) {
            entries.push(...buildFeatureSelectionEntries(marker, member.layerId));
        }
    }
    return entries;
}

export function buildAllFeatureMembers(): GroupMember[] {
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
