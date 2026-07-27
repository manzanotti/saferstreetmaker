import { defineStore } from 'pinia';
import { computed, shallowRef } from 'vue';
import type { FeatureMembershipLocation } from '../features/groups/featureMemberships';
import { membershipKey } from '../features/groups/featureMemberships';

export interface PendingFeatureDeletion {
    layerId: string;
    historyId: string;
    memberships: FeatureMembershipLocation[];
}

export const useFeatureDeletionStore = defineStore('featureDeletion', () => {
    const pending = shallowRef<PendingFeatureDeletion | null>(null);
    const selectedMembershipKey = shallowRef<string | null>(null);
    const selectedMembership = computed(
        () =>
            pending.value?.memberships.find(
                (membership) => membershipKey(membership) === selectedMembershipKey.value
            ) ?? null
    );

    function open(request: PendingFeatureDeletion) {
        pending.value = request;
        const initialMembership =
            request.memberships.find((membership) => membership.isActive) ??
            request.memberships[0] ??
            null;
        selectedMembershipKey.value = initialMembership ? membershipKey(initialMembership) : null;
    }

    function selectMembership(key: string) {
        if (pending.value?.memberships.some((membership) => membershipKey(membership) === key)) {
            selectedMembershipKey.value = key;
        }
    }

    function close() {
        pending.value = null;
        selectedMembershipKey.value = null;
    }

    return {
        pending,
        selectedMembershipKey,
        selectedMembership,
        open,
        selectMembership,
        close
    };
});
