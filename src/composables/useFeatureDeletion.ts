import type * as L from 'leaflet';
import { pinia } from '../stores';
import { useFeatureDeletionStore } from '../stores/featureDeletionStore';
import { useGroupStore } from '../stores/groupStore';
import { useMapStore } from '../stores/mapStore';
import { useSelectionStore } from '../stores/selectionStore';
import { getGroupVersions } from '../features/groups/groupVersions';
import { getFeatureHistoryId } from './layers/layerUtils';
import { applySelectionHighlights } from './useAreaSelection';
import { recomputeFeatureVisibility } from './useGroups';

export type FeatureDeletionScope = 'version' | 'group' | 'everything';

function findFeature(layerId: string, historyId: string): L.Layer | null {
    const layer = useMapStore(pinia)
        .layers.find((item) => item.id === layerId)
        ?.getLayer();
    let found: L.Layer | null = null;
    layer?.eachLayer((marker) => {
        if (getFeatureHistoryId(marker) === historyId) {
            found = marker;
        }
    });
    return found;
}

export function confirmFeatureDeletion(scope: FeatureDeletionScope): boolean {
    const deletionStore = useFeatureDeletionStore(pinia);
    const request = deletionStore.pending;
    const selectedMembership = deletionStore.selectedMembership;
    if (!request || !selectedMembership) {
        return false;
    }

    const member = { layerId: request.layerId, historyId: request.historyId };
    const groupStore = useGroupStore(pinia);
    if (scope === 'version') {
        groupStore.removeMemberFromVersions(
            selectedMembership.groupId,
            [selectedMembership.versionId],
            member
        );
    } else if (scope === 'group') {
        const group = groupStore.groups.find((item) => item.id === selectedMembership.groupId);
        if (group) {
            groupStore.removeMemberFromVersions(
                group.id,
                getGroupVersions(group).map((version) => version.id),
                member
            );
        }
    } else {
        for (const group of groupStore.groups) {
            groupStore.removeMemberFromVersions(
                group.id,
                getGroupVersions(group).map((version) => version.id),
                member
            );
        }
        const marker = findFeature(request.layerId, request.historyId);
        const layer = useMapStore(pinia).layers.find((item) => item.id === request.layerId);
        if (marker && layer) {
            layer.getLayer().removeLayer(marker);
        }
    }

    recomputeFeatureVisibility();
    const selectionStore = useSelectionStore(pinia);
    applySelectionHighlights([], true, selectionStore.selected);
    selectionStore.deactivate();
    findFeature(request.layerId, request.historyId)?.editing?.disable?.();
    deletionStore.close();
    useMapStore(pinia).markLayerUpdated();
    return true;
}

export function cancelFeatureDeletion(): void {
    useFeatureDeletionStore(pinia).close();
}
