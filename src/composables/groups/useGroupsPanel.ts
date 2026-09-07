import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useGroupStore } from '../../stores/groupStore';
import { useUiStore } from '../../stores/uiStore';
import { getActiveVersion, memberKey } from '../../features/groups/groupVersions';
import {
    deleteGroup,
    deleteGroupWithElements,
    openGroupDetails,
    setAllGroupsVisibility,
    toggleGroupVisibility
} from '../useGroups';

export function useGroupsPanel() {
    const groupStore = useGroupStore();
    const uiStore = useUiStore();
    const pendingDeleteGroupId = ref<string | null>(null);
    const pendingEmptyGroupDeletionId = computed(() => groupStore.pendingEmptyGroupDeletionId);
    const memberCountByGroupId = computed<Record<string, number>>(() =>
        Object.fromEntries(
            groupStore.groups.map((group) => [
                group.id,
                new Set(
                    getActiveVersion(group, groupStore.activeVersionIds[group.id]).members.map(
                        memberKey
                    )
                ).size
            ])
        )
    );
    const allHidden = computed(
        () =>
            groupStore.groups.length > 0 &&
            groupStore.groups.every((group) => groupStore.hiddenGroupIds.has(group.id))
    );

    function closePanel() {
        uiStore.closePanel();
        (document.activeElement as HTMLElement | null)?.blur();
    }

    function onKeydown(event: KeyboardEvent) {
        if (event.key !== 'Escape') {
            return;
        }
        if (pendingDeleteGroupId.value) {
            pendingDeleteGroupId.value = null;
            return;
        }
        if (pendingEmptyGroupDeletionId.value) {
            groupStore.setPendingEmptyGroupDeletion(null);
            return;
        }
        closePanel();
    }

    function onDeleteRequest(groupId: string) {
        const memberCount = memberCountByGroupId.value[groupId] ?? 0;
        if (memberCount === 0) {
            deleteGroup(groupId);
            return;
        }
        pendingDeleteGroupId.value = groupId;
    }

    function confirmDelete(deleteElements: boolean) {
        const groupId = pendingDeleteGroupId.value;
        if (!groupId) {
            return;
        }
        if (deleteElements) {
            deleteGroupWithElements(groupId);
        } else {
            deleteGroup(groupId);
        }
        pendingDeleteGroupId.value = null;
    }

    function cancelDelete() {
        pendingDeleteGroupId.value = null;
    }

    function deleteEmptyGroup(groupId: string) {
        deleteGroup(groupId);
        groupStore.setPendingEmptyGroupDeletion(null);
    }

    function keepEmptyGroup() {
        groupStore.setPendingEmptyGroupDeletion(null);
    }

    onMounted(() => {
        groupStore.closeDetailsDialog();
        document.addEventListener('keydown', onKeydown);
    });
    onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown));

    return {
        groupStore,
        allHidden,
        memberCountByGroupId,
        pendingDeleteGroupId,
        pendingEmptyGroupDeletionId,
        cancelDelete,
        closePanel,
        confirmDelete,
        deleteEmptyGroup,
        keepEmptyGroup,
        onDeleteRequest,
        openGroupDetails,
        setAllGroupsVisibility,
        toggleGroupVisibility
    };
}
