<script setup lang="ts">
import type { Group, GroupVersion } from '../../../models/Group';
import GroupVersionCreateForm from './GroupVersionCreateForm.vue';
import GroupVersionDeletePrompt from './GroupVersionDeletePrompt.vue';
import GroupVersionRow from './GroupVersionRow.vue';

defineProps<{
    group: Group;
    versions: GroupVersion[];
    activeVersionId?: string;
    readOnly: boolean;
    versionMemberCounts: Record<string, number>;
    versionNames: Record<string, string>;
    versionErrors: Record<string, string>;
    versionEditorOpen: boolean;
    versionName: string;
    versionError: string;
    pendingVersionDelete: { id: string; name: string; memberCount: number } | null;
}>();

const emit = defineEmits<{
    createVersion: [];
    'update:versionName': [name: string];
    updateVersionName: [versionId: string, name: string];
    saveVersion: [];
    cancelVersionEdit: [];
    selectVersion: [versionId: string];
    saveVersionName: [versionId: string];
    openPhases: [versionId: string];
    setDefault: [versionId: string];
    requestDeleteVersion: [versionId: string];
    confirmDeleteVersion: [deleteElements: boolean];
    cancelDeleteVersion: [];
}>();
</script>

<template>
    <section class="border-t border-gray-100 pt-3" aria-labelledby="group-versions-title">
        <div class="mb-2 flex items-center justify-between gap-2">
            <h3 id="group-versions-title" class="text-sm font-semibold text-gray-800">Versions</h3>
            <button
                v-if="!readOnly"
                type="button"
                class="rounded border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                aria-label="Create version"
                @click="emit('createVersion')"
            >
                + Version
            </button>
        </div>
        <div class="space-y-2">
            <div role="list" :aria-label="`Versions for group ${group.name}`" class="space-y-1">
                <GroupVersionRow
                    v-for="version in versions"
                    :key="version.id"
                    :group="group"
                    :version="version"
                    :active="activeVersionId === version.id"
                    :read-only="readOnly"
                    :versions-count="versions.length"
                    :member-count="versionMemberCounts[version.id]"
                    :version-name="versionNames[version.id]"
                    :error="versionErrors[version.id]"
                    @update:version-name="emit('updateVersionName', version.id, $event)"
                    @select="emit('selectVersion', version.id)"
                    @save-name="emit('saveVersionName', version.id)"
                    @open-phases="emit('openPhases', version.id)"
                    @set-default="emit('setDefault', version.id)"
                    @delete-request="emit('requestDeleteVersion', version.id)"
                />
            </div>
        </div>
        <GroupVersionCreateForm
            v-if="versionEditorOpen"
            :version-name="versionName"
            :error="versionError"
            @update:version-name="emit('update:versionName', $event)"
            @save="emit('saveVersion')"
            @cancel="emit('cancelVersionEdit')"
        />
        <GroupVersionDeletePrompt
            v-if="pendingVersionDelete"
            :version-name="pendingVersionDelete.name"
            :member-count="pendingVersionDelete.memberCount"
            @confirm="emit('confirmDeleteVersion', $event)"
            @cancel="emit('cancelDeleteVersion')"
        />
    </section>
</template>
