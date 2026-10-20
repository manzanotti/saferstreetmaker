import type * as L from 'leaflet';
import { useMapStore } from '../../stores/mapStore';
import { useSelectionStore } from '../../stores/selectionStore';
import { useGroupStore } from '../../stores/groupStore';
import { pinia } from '../../stores/index';
import {
    featureKey,
    getActiveVersion,
    getAllGroupMembers,
    getGroupVersions,
    getUnassignedGroupMembers,
    hasVersionName
} from './groupVersions';
import {
    buildHistoryId,
    getFeatureHistoryId
} from '../../composables/layers/features/featureLookup';

export interface GroupMutationDependencies {
    clearFeatureHighlight: () => void;
    findMarkerByHistoryId: (layerId: string, historyId: string) => L.Layer | null;
    recomputeFeatureVisibility: () => void;
    revealMarker: (marker: L.Layer) => void;
    switchGroupVersion: (groupId: string, versionId: string) => boolean;
}

export function createGroupMutations(dependencies: GroupMutationDependencies) {
    function createGroupVersion(groupId: string, name: string): boolean {
        const groupStore = useGroupStore(pinia);
        const group = groupStore.groups.find((item) => item.id === groupId);
        const mapStore = useMapStore(pinia);
        if (!group || !name.trim() || hasVersionName(group, name)) {
            return false;
        }

        const version = {
            id: buildHistoryId('group-version'),
            name: name.trim(),
            members: getUnassignedGroupMembers(group)
        };
        if (!groupStore.addVersion(groupId, version)) {
            return false;
        }
        mapStore.markLayerUpdated();
        return dependencies.switchGroupVersion(groupId, version.id);
    }

    function renameGroupVersion(groupId: string, versionId: string, name: string): boolean {
        const groupStore = useGroupStore(pinia);
        const mapStore = useMapStore(pinia);
        const renamed = groupStore.renameVersion(groupId, versionId, name);
        if (renamed) {
            mapStore.markLayerUpdated();
        }
        return renamed;
    }

    function setGroupDefaultVersion(groupId: string, versionId: string): boolean {
        const groupStore = useGroupStore(pinia);
        const mapStore = useMapStore(pinia);
        const changed = groupStore.setDefaultVersion(groupId, versionId);
        if (changed) {
            mapStore.markLayerUpdated();
        }
        return changed;
    }

    function deleteGroupVersion(
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
            dependencies.clearFeatureHighlight();
        }
        const version = groupStore.removeVersion(groupId, versionId, !deleteElements);
        if (!version) {
            return false;
        }
        const mapStore = useMapStore(pinia);
        if (deleteElements) {
            const remainingMembers = new Set(
                groupStore.groups.flatMap((group) =>
                    getAllGroupMembers(group).map((member) =>
                        featureKey(member.layerId, member.historyId)
                    )
                )
            );
            for (const member of version.members) {
                if (remainingMembers.has(featureKey(member.layerId, member.historyId))) {
                    continue;
                }
                const marker = dependencies.findMarkerByHistoryId(member.layerId, member.historyId);
                const layer = mapStore.layers.find((item) => item.id === member.layerId);
                if (marker && layer) {
                    layer.getLayer().removeLayer(marker);
                }
            }
        }
        mapStore.markLayerUpdated();
        dependencies.recomputeFeatureVisibility();
        return true;
    }

    function deleteGroupWithElements(id: string): void {
        const groupStore = useGroupStore(pinia);
        const mapStore = useMapStore(pinia);

        const group = groupStore.groups.find((item) => item.id === id);
        if (!group) {
            return;
        }
        const members = getAllGroupMembers(group);

        for (const member of members) {
            const marker = dependencies.findMarkerByHistoryId(member.layerId, member.historyId);
            if (marker) {
                dependencies.revealMarker(marker);
            }
        }

        const seen = new Set<string>();
        for (const member of members) {
            const key = featureKey(member.layerId, member.historyId);
            if (seen.has(key)) {
                continue;
            }
            seen.add(key);

            const marker = dependencies.findMarkerByHistoryId(member.layerId, member.historyId);
            const layerDef = mapStore.layers.find((layer) => layer.id === member.layerId);
            if (marker && layerDef) {
                layerDef.getLayer().removeLayer(marker);
            }
        }

        groupStore.removeGroup(id);
        dependencies.clearFeatureHighlight();
        dependencies.recomputeFeatureVisibility();
        mapStore.markLayerUpdated();
    }

    function removeAllGroupElements(id: string): void {
        const groupStore = useGroupStore(pinia);
        const mapStore = useMapStore(pinia);
        groupStore.clearGroupMembers(id);
        dependencies.clearFeatureHighlight();
        dependencies.recomputeFeatureVisibility();
        mapStore.markLayerUpdated();
    }

    function deleteGroup(id: string): void {
        const groupStore = useGroupStore(pinia);
        const mapStore = useMapStore(pinia);
        groupStore.removeGroup(id);
        dependencies.clearFeatureHighlight();
        dependencies.recomputeFeatureVisibility();
        mapStore.markLayerUpdated();
    }

    function toggleGroupVisibility(id: string): void {
        const groupStore = useGroupStore(pinia);
        if (groupStore.soloGroupId || groupStore.hiddenGroupIds.has(id)) {
            dependencies.clearFeatureHighlight();
        }
        groupStore.cycleVisibility(id);
        dependencies.recomputeFeatureVisibility();
    }

    function setAllGroupsVisibility(hidden: boolean): void {
        const groupStore = useGroupStore(pinia);
        groupStore.setAllHidden(groupStore.soloGroupId ? false : hidden);
        dependencies.recomputeFeatureVisibility();
    }

    function pruneDanglingGroupMembers(): boolean {
        const groupStore = useGroupStore(pinia);
        const mapStore = useMapStore(pinia);

        if (groupStore.groups.length === 0) {
            return false;
        }

        const existing = new Set<string>();
        for (const layer of mapStore.layers) {
            layer.getLayer().eachLayer((marker) => {
                const historyId = getFeatureHistoryId(marker);
                if (historyId) {
                    existing.add(featureKey(layer.id, historyId));
                }
            });
        }

        let changed = false;
        const nextGroups = groupStore.groups.map((group) => {
            const unassignedMembers = getUnassignedGroupMembers(group).filter((member) =>
                existing.has(featureKey(member.layerId, member.historyId))
            );
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
                unassignedMembers.length !== (group.unassignedMembers ?? []).length ||
                kept.length !== currentMembers.length ||
                versions.some(
                    (version, index) =>
                        version.members.length !== getGroupVersions(group)[index].members.length
                )
            ) {
                changed = true;
                return {
                    ...group,
                    versions,
                    members: kept,
                    ...(group.unassignedMembers ? { unassignedMembers } : {})
                };
            }
            return group;
        });

        if (changed) {
            groupStore.setGroups(nextGroups, true);
        }
        return changed;
    }

    return {
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
    };
}
