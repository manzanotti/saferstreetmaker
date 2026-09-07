import { useMapStore } from '../../stores/mapStore';
import { useSelectionStore } from '../../stores/selectionStore';
import { useGroupStore } from '../../stores/groupStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { featureKey, getGroupVersions, hasVersionName } from '../../features/groups/groupVersions';
import { GroupVersionFeatureCloner } from '../../features/groups/GroupVersionFeatureCloner';
import { pinia } from '../../stores/index';
import { getFeatureHistoryId } from '../layers/layerUtils';
import { applySelectionHighlights, clearFeatureHighlight } from '../useAreaSelection';
import { findMarkerByHistoryId, groupLtnFillController } from './groupsShared';
import { recomputeFeatureVisibility, selectGroup } from './useGroupVisibility';
import {
    applyReadOnlyGroupPresentation,
    clearReadOnlyEditingState
} from './useGroupReadOnlyPresentation';
import { stopReadOnlyGroupPlayback } from './useGroupPhases';

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
