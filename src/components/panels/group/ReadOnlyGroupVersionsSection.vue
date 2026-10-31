<script setup lang="ts">
import type { Group, GroupVersion } from '../../../models/Group';
import { useGroupStore } from '../../../stores/groupStore';
import { viewGroupVersion } from '../../../composables/useGroups';
import { memberKey } from '../../../features/groups/groupVersions';

const props = defineProps<{
    group: Group;
    versions: GroupVersion[];
}>();

const groupStore = useGroupStore();

function memberCount(version: GroupVersion) {
    return new Set(version.members.map(memberKey)).size;
}

function viewVersion(versionId: string) {
    viewGroupVersion(props.group.id, versionId);
}
</script>

<template>
    <section aria-labelledby="read-only-group-versions-title">
        <h3 id="read-only-group-versions-title" class="mb-2 text-sm font-semibold text-gray-800">
            Versions
        </h3>
        <div role="list" :aria-label="`Versions for group ${group.name}`" class="space-y-1">
            <div
                v-for="version in versions"
                :key="version.id"
                role="listitem"
                class="rounded border px-2 py-2"
                :class="
                    groupStore.activeVersionIds[group.id] === version.id
                        ? 'border-green-300 bg-green-50'
                        : 'border-gray-200'
                "
            >
                <div class="flex flex-wrap items-center gap-2">
                    <span class="min-w-0 flex-1 text-sm font-medium text-gray-700">{{
                        version.name
                    }}</span>
                    <button
                        v-if="groupStore.activeVersionIds[group.id] !== version.id"
                        type="button"
                        :aria-label="`View version ${version.name}`"
                        class="shrink-0 rounded border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-white"
                        @click="viewVersion(version.id)"
                    >
                        View
                    </button>
                    <span class="shrink-0 text-xs text-gray-500"
                        >({{ memberCount(version) }} feature{{
                            memberCount(version) === 1 ? '' : 's'
                        }})</span
                    >
                </div>
            </div>
        </div>
    </section>
</template>
