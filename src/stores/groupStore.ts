import { defineStore } from 'pinia';
import { ref, shallowRef } from 'vue';
import type { Group, GroupMember, PartialPolylineSplit } from '../models/Group';

export const useGroupStore = defineStore('group', () => {
    /** Groups — part of the persisted map payload and included in undo snapshots. */
    const groups = ref<Group[]>([]);

    /** Runtime-only: not persisted, not part of undo snapshots. */
    const hiddenGroupIds = ref<Set<string>>(new Set());

    // ── Transient dialog state ────────────────────────────────────────────────
    const nameDialogOpen = ref(false);
    /** Non-null when the name dialog is being used for rename; null = create mode. */
    const renameGroupId = ref<string | null>(null);

    // pendingSplits contains L.Layer references — shallowRef prevents Vue Proxy wrapping.
    const pendingSplits = shallowRef<PartialPolylineSplit[]>([]);
    const splitDialogOpen = ref(false);

    /** Members to add when the next group is created (computed before opening nameDialog). */
    const pendingGroupMembers = ref<GroupMember[]>([]);

    /**
     * When non-null, the area-selection flow is targeting an existing group:
     * confirming the selection adds the features to this group rather than
     * creating a new one. Drives the "Add to group" affordances in the
     * selection toolbar. Reset whenever selection is deactivated.
     */
    const addToGroupId = ref<string | null>(null);

    // ── Group mutations ───────────────────────────────────────────────────────

    function setGroups(newGroups: Group[]) {
        groups.value = newGroups;
    }

    function addGroup(group: Group) {
        groups.value = [...groups.value, group];
    }

    function renameGroup(id: string, name: string) {
        groups.value = groups.value.map((g) => (g.id === id ? { ...g, name } : g));
    }

    function removeGroup(id: string) {
        groups.value = groups.value.filter((g) => g.id !== id);
        const next = new Set(hiddenGroupIds.value);
        next.delete(id);
        hiddenGroupIds.value = next;
    }

    function addMembersToGroup(id: string, members: GroupMember[]) {
        groups.value = groups.value.map((g) => {
            if (g.id !== id) {
                return g;
            }
            const existingKeys = new Set(g.members.map((m) => `${m.layerId}:${m.historyId}`));
            const toAdd = members.filter((m) => !existingKeys.has(`${m.layerId}:${m.historyId}`));
            return { ...g, members: [...g.members, ...toAdd] };
        });
    }

    function clearGroupMembers(id: string) {
        groups.value = groups.value.map((g) => (g.id === id ? { ...g, members: [] } : g));
    }

    // ── Visibility ────────────────────────────────────────────────────────────

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
        if (hidden) {
            hiddenGroupIds.value = new Set(groups.value.map((g) => g.id));
        } else {
            hiddenGroupIds.value = new Set<string>();
        }
    }

    // ── Dialog control ────────────────────────────────────────────────────────

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

    /**
     * Close the split dialog but RETAIN pendingSplits so the split can be
     * performed later when the group is confirmed (deferred split).
     */
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
