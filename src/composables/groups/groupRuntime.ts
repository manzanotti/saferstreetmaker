import * as L from 'leaflet';
import type { GroupMember, GroupPhase } from '../../models/Group';
import type { SelectedMarker } from '../../stores/selectionStore';
import { useMapStore } from '../../stores/mapStore';
import { useSelectionStore } from '../../stores/selectionStore';
import { useGroupStore } from '../../stores/groupStore';
import { pinia } from '../../stores/index';
import { findLayerFeatureByHistoryId } from '../layers/features/featureLookup';
import { removeMapCursor } from '../layers/features/featureCursors';
import { buildFeatureSelectionEntries, applySelectionHighlights } from '../useAreaSelection';
import { GroupVisibilityController } from '../../features/groups/GroupVisibilityController';
import { GroupLtnFillController } from '../../features/groups/GroupLtnFillController';
import { PhaseHighlighter } from '../../features/groups/PhaseHighlighter';

export function findMarkerByHistoryId(layerId: string, historyId: string): L.Layer | null {
    return findLayerFeatureByHistoryId(useMapStore(pinia).layers, layerId, historyId);
}

export const groupVisibilityController = new GroupVisibilityController({
    getGroups: () => useGroupStore(pinia).groups,
    getHiddenGroupIds: () => useGroupStore(pinia).effectiveHiddenGroupIds,
    getActiveVersionIds: () => useGroupStore(pinia).activeVersionIds,
    getSoloGroupId: () => useGroupStore(pinia).soloGroupId,
    beforeHide: (marker) => phaseHighlighter.clearMarker(marker),
    onHideEditedFeature: () => useMapStore(pinia).setDrawLayer(null),
    getAllMarkers: () => {
        const markers: L.Layer[] = [];
        for (const layer of useMapStore(pinia).layers) {
            layer.getLayer().eachLayer((marker) => markers.push(marker));
        }
        return markers;
    },
    findMarker: (member) => findMarkerByHistoryId(member.layerId, member.historyId)
});

export const groupLtnFillController = new GroupLtnFillController({
    getGroups: () => useGroupStore(pinia).groups,
    getHiddenGroupIds: () => useGroupStore(pinia).effectiveHiddenGroupIds,
    getActiveVersionIds: () => useGroupStore(pinia).activeVersionIds,
    getLayer: () =>
        (useMapStore(pinia)
            .layers.find((layer) => layer.id === 'LtnCells')
            ?.getLayer() as L.LayerGroup | undefined) ?? null
});

export const phaseHighlighter = new PhaseHighlighter((member) =>
    findMarkerByHistoryId(member.layerId, member.historyId)
);
function clonePhases(phases: GroupPhase[]): GroupPhase[] {
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

let recomputingFeatureVisibility = false;

export function recomputeFeatureVisibility(): void {
    if (recomputingFeatureVisibility) {
        return;
    }
    recomputingFeatureVisibility = true;
    try {
        groupVisibilityController.recompute();
        groupLtnFillController.recompute();
        const selectionStore = useSelectionStore(pinia);
        if (selectionStore.isActive && selectionStore.selected.length > 0) {
            applySelectionHighlights(selectionStore.selected, true);
        }
    } finally {
        recomputingFeatureVisibility = false;
    }
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
