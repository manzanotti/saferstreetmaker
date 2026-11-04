import type { GroupMember } from '../../models/Group';
import { useMapStore } from '../../stores/mapStore';
import { useSelectionStore } from '../../stores/selectionStore';
import { useGroupStore } from '../../stores/groupStore';
import { pinia } from '../../stores/index';
import { featureKey, getGroupVersions } from '../../features/groups/groupVersions';
import { GroupVersionFeatureCloner } from '../../features/groups/GroupVersionFeatureCloner';
import { GroupPolylineSplitter } from '../../features/groups/GroupPolylineSplitter';
import { analyzeSelectionMembership } from '../../features/groups/groupMembership';
import { buildHistoryId, getFeatureHistoryId } from '../layers/features/featureLookup';

const groupPolylineSplitter = new GroupPolylineSplitter({
    getLayer: (layerId) => useMapStore(pinia).layers.find((layer) => layer.id === layerId),
    createHistoryId: () => buildHistoryId('polyline')
});

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

export function performPendingSplits(): GroupMember[] {
    const groupStore = useGroupStore(pinia);
    return groupPolylineSplitter.split([...groupStore.pendingSplits]);
}
