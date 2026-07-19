import { defineStore } from 'pinia';
import { ref, shallowRef } from 'vue';
import type * as L from 'leaflet';

export interface GroupMember {
    layerId: string;
    historyId: string;
}

export interface Group {
    id: string;
    name: string;
    members: GroupMember[];
}

export interface PartialPolylineSplit {
    layerId: string;
    layerTitle: string;
    /** The Leaflet Layer being partially selected (must NOT be wrapped in Vue Proxy). */
    marker: L.Layer;
    /** The selected LatLng references from selectionStore.selected. */
    selectedLatLngs: L.LatLng[];
    /** All LatLngs of the polyline. */
    allLatLngs: L.LatLng[];
    /**
     * Bounds of the selection rectangle, when the selection came from a
     * rubber-band drag. Used to clip the new line to the selection area so it
     * extends to where the polyline crosses the rectangle edge. Null when the
     * selection region is unknown (falls back to selected-vertices-only split).
     */
    clipBounds?: L.LatLngBounds | null;
}

export const useGroupStore = defineStore('group', () => {
    /** Groups - part of the persisted map payload and included in undo snapshots. */
    const groups = ref<Group[]>([]);

    /** Runtime-only: not persisted, not part of undo snapshots. */
    const hiddenGroupIds = ref<Set<string>>(new Set());

    // Transient dialog state.
    const nameDialogOpen = ref(false);
    const renameGroupId = ref<string | null>(null);

    // pendingSplits contains L.Layer references; shallowRef prevents Vue Proxy wrapping.
    const pendingSplits = shallowRef<PartialPolylineSplit[]>([]);
    const splitDialogOpen = ref(false);

    const pendingGroupMembers = ref<GroupMember[]>([]);
    const addToGroupId = ref<string | null>(null);

    function setGroups(newGroups: Group[]) {
        groups.value = newGroups;
    }

    function addGroup(group: Group) {
        groups.value = [...groups.value, group];
    }

    function renameGroup(id: string, name: string) {
        groups.value = groups.value.map((group) => (group.id === id ? { ...group, name } : group));
    }

    function removeGroup(id: string) {
        groups.value = groups.value.filter((group) => group.id !== id);
        const next = new Set(hiddenGroupIds.value);
        next.delete(id);
        hiddenGroupIds.value = next;
    }

    function addMembersToGroup(id: string, members: GroupMember[]) {
        groups.value = groups.value.map((group) => {
            if (group.id !== id) {
                return group;
            }
            const existingKeys = new Set(
                group.members.map((member) => `${member.layerId}:${member.historyId}`)
            );
            const toAdd = members.filter((member) => {
                return !existingKeys.has(`${member.layerId}:${member.historyId}`);
            });
            return { ...group, members: [...group.members, ...toAdd] };
        });
    }

    function clearGroupMembers(id: string) {
        groups.value = groups.value.map((group) =>
            group.id === id ? { ...group, members: [] } : group
        );
    }

    function toggleHidden(id: string) {
        const next = new Set(hiddenGroupIds.value);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        hiddenGroupIds.value = next;
    }

    function setAllHidden(hidden: boolean) {
        hiddenGroupIds.value = hidden
            ? new Set(groups.value.map((group) => group.id))
            : new Set<string>();
    }

    function openNameDialog(forRenameId: string | null = null) {
        renameGroupId.value = forRenameId;
        nameDialogOpen.value = true;
    }

    function closeNameDialog() {
        nameDialogOpen.value = false;
        renameGroupId.value = null;
    }

    function openSplitDialog(splits: PartialPolylineSplit[]) {
        pendingSplits.value = splits;
        splitDialogOpen.value = true;
    }

    function approveSplitDialog() {
        splitDialogOpen.value = false;
    }

    function closeSplitDialog() {
        pendingSplits.value = [];
        splitDialogOpen.value = false;
    }

    function setPendingGroupMembers(members: GroupMember[]) {
        pendingGroupMembers.value = members;
    }

    function setAddToGroupId(id: string | null) {
        addToGroupId.value = id;
    }

    function clearPendingState() {
        pendingGroupMembers.value = [];
        pendingSplits.value = [];
        renameGroupId.value = null;
        addToGroupId.value = null;
    }

    return {
        groups,
        hiddenGroupIds,
        nameDialogOpen,
        renameGroupId,
        pendingSplits,
        splitDialogOpen,
        pendingGroupMembers,
        addToGroupId,
        setGroups,
        addGroup,
        renameGroup,
        removeGroup,
        addMembersToGroup,
        clearGroupMembers,
        toggleHidden,
        setAllHidden,
        openNameDialog,
        closeNameDialog,
        openSplitDialog,
        approveSplitDialog,
        closeSplitDialog,
        setPendingGroupMembers,
        setAddToGroupId,
        clearPendingState
    };
});
