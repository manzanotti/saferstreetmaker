import type * as L from 'leaflet';
import { pinia } from '../stores';
import { useFeatureDeletionStore } from '../stores/featureDeletionStore';
import { useGroupStore } from '../stores/groupStore';
import { useMapStore } from '../stores/mapStore';
import { useSelectionStore } from '../stores/selectionStore';
import { getGroupVersions } from '../features/groups/groupVersions';
import { findLayerFeatureByHistoryId } from './layers/layerUtils';
import { applySelectionHighlights } from './useAreaSelection';
import { recomputeFeatureVisibility } from './useGroups';

export type FeatureDeletionScope = 'version' | 'group' | 'everything';

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
        const marker = findLayerFeatureByHistoryId(
            useMapStore(pinia).layers,
            request.layerId,
            request.historyId
        );
        const layer = useMapStore(pinia).layers.find((item) => item.id === request.layerId);
        if (marker && layer) {
            layer.getLayer().removeLayer(marker);
        }
    }

    recomputeFeatureVisibility();
    const selectionStore = useSelectionStore(pinia);
    applySelectionHighlights([], true, selectionStore.selected);
    selectionStore.deactivate();
    findLayerFeatureByHistoryId(
        useMapStore(pinia).layers,
        request.layerId,
        request.historyId
    )?.editing?.disable?.();
    deletionStore.close();
    useMapStore(pinia).markLayerUpdated();
    return true;
}

export function cancelFeatureDeletion(): void {
    useFeatureDeletionStore(pinia).close();
}
