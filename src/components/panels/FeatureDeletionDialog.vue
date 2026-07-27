<script setup lang="ts">
import { computed, nextTick, useTemplateRef, watch } from 'vue';
import { membershipKey } from '../../features/groups/featureMemberships';
import { useFeatureDeletionStore } from '../../stores/featureDeletionStore';
import {
    cancelFeatureDeletion,
    confirmFeatureDeletion
} from '../../composables/useFeatureDeletion';

const deletionStore = useFeatureDeletionStore();
const firstMembership = useTemplateRef<HTMLInputElement>('firstMembership');
const selectedGroupName = computed(() => deletionStore.selectedMembership?.groupName ?? 'group');

watch(
    () => deletionStore.pending,
    (pending) => {
        if (pending) {
            void nextTick(() => firstMembership.value?.focus());
        }
    }
);

function onMembershipChange(event: Event) {
    deletionStore.selectMembership((event.target as HTMLInputElement).value);
}

function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
        cancelFeatureDeletion();
    }
}
</script>

<template>
    <div
        v-if="deletionStore.pending"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feature-deletion-title"
        class="fixed top-1/2 left-1/2 z-10000 flex max-h-[90vh] w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl"
        @keydown.stop="onKeydown"
    >
        <div class="border-b border-gray-200 px-5 py-4">
            <h2 id="feature-deletion-title" class="text-base font-semibold text-gray-900">
                Delete grouped line
            </h2>
            <p class="mt-1 text-sm text-gray-600">
                This line appears in the following group versions. Select the version to act on.
            </p>
        </div>

        <fieldset class="overflow-y-auto px-5 py-4">
            <legend class="sr-only">Group versions containing this line</legend>
            <div class="divide-y divide-gray-100 rounded-md border border-gray-200">
                <label
                    v-for="(membership, index) in deletionStore.pending.memberships"
                    :key="membershipKey(membership)"
                    class="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-gray-50"
                >
                    <input
                        :ref="index === 0 ? 'firstMembership' : undefined"
                        type="radio"
                        name="feature-deletion-membership"
                        :value="membershipKey(membership)"
                        :checked="deletionStore.selectedMembershipKey === membershipKey(membership)"
                        class="mt-0.5 h-4 w-4 accent-blue-600"
                        @change="onMembershipChange"
                    />
                    <span class="min-w-0 text-sm">
                        <span class="block font-medium text-gray-800">{{
                            membership.groupName
                        }}</span>
                        <span class="text-gray-600">{{ membership.versionName }}</span>
                        <span
                            v-if="membership.isActive"
                            class="ml-2 text-xs font-medium text-blue-700"
                        >
                            shown on map
                        </span>
                    </span>
                </label>
            </div>
        </fieldset>

        <div class="grid gap-2 border-t border-gray-200 bg-gray-50 px-5 py-4 sm:grid-cols-2">
            <button
                type="button"
                class="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                @click="confirmFeatureDeletion('version')"
            >
                Remove from selected version
            </button>
            <button
                type="button"
                class="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                @click="confirmFeatureDeletion('group')"
            >
                Remove from all {{ selectedGroupName }} versions
            </button>
            <button
                type="button"
                class="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                @click="confirmFeatureDeletion('everything')"
            >
                Delete everywhere
            </button>
            <button
                type="button"
                class="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                @click="cancelFeatureDeletion"
            >
                Cancel
            </button>
        </div>
    </div>
</template>
