import type { GroupMember } from '../../models/Group';
import { useMapStore } from '../../stores/mapStore';
import { useGroupStore } from '../../stores/groupStore';
import { pinia } from '../../stores/index';
import { getGroupVersions } from '../../features/groups/groupVersions';
import { normalizeGroupColour } from '../../features/groups/groupColours';
import { recomputeFeatureVisibility } from './groupRuntime';

export function applyGroupColor(id: string, color: string): boolean {
    const normalizedColor = normalizeGroupColour(color);
    const groupStore = useGroupStore(pinia);
    const mapStore = useMapStore(pinia);
    const group = groupStore.groups.find((item) => item.id === id);
    if (!group || !normalizedColor || group.color === normalizedColor) {
        return false;
    }

    groupStore.setColor(id, normalizedColor);
    recomputeFeatureVisibility();
    mapStore.markLayerUpdated();
    return true;
}

export function applyGroupDescription(id: string, description: string): boolean {
    const groupStore = useGroupStore(pinia);
    const mapStore = useMapStore(pinia);
    const updated = groupStore.setDescription(id, description);
    if (!updated) {
        return false;
    }

    mapStore.markLayerUpdated();
    return true;
}

export function applyGroupDetails(
    id: string,
    name: string,
    color: string,
    description: string
): boolean {
    const groupStore = useGroupStore(pinia);
    const mapStore = useMapStore(pinia);
    const normalizedColor = normalizeGroupColour(color) ?? '';
    const updated = groupStore.setMetadata(id, name, normalizedColor, description);
    if (!updated) {
        return false;
    }

    recomputeFeatureVisibility();
    mapStore.markLayerUpdated();
    return true;
}

export function removeFeatureFromGroup(groupId: string, member: GroupMember): boolean {
    const groupStore = useGroupStore(pinia);
    const group = groupStore.groups.find((item) => item.id === groupId);
    if (!group) {
        return false;
    }

    const versionIds = getGroupVersions(group).map((version) => version.id);
    const removed = groupStore.removeMemberFromVersions(groupId, versionIds, member, true);
    if (!removed) {
        return false;
    }

    recomputeFeatureVisibility();
    useMapStore(pinia).markLayerUpdated();
    return true;
}

export function addFeatureToGroup(groupId: string, member: GroupMember): boolean {
    const groupStore = useGroupStore(pinia);
    const group = groupStore.groups.find((item) => item.id === groupId);
    if (!group) {
        return false;
    }

    groupStore.addMembersToGroup(groupId, [member]);
    recomputeFeatureVisibility();
    useMapStore(pinia).markLayerUpdated();
    return true;
}
