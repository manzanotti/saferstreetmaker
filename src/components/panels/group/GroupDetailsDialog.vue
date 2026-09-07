<script setup lang="ts">
import { ref, useTemplateRef } from 'vue';
import { useGroupDetailsDialog } from '../../../composables/groups/useGroupDetailsDialog';
import GroupDetailsDeletePrompt from './GroupDetailsDeletePrompt.vue';
import GroupDetailsHeader from './GroupDetailsHeader.vue';
import GroupDetailsMetadataForm from './GroupDetailsMetadataForm.vue';
import GroupVersionsSection from './GroupVersionsSection.vue';

type GroupDetailsMetadataFormComponent = InstanceType<typeof GroupDetailsMetadataForm>;

const metadataForm = ref<GroupDetailsMetadataFormComponent | null>(null);
const dialog = useTemplateRef<HTMLDivElement>('dialog');

const {
    groupStore,
    settingsStore,
    group,
    versions,
    versionMemberCounts,
    name,
    color,
    description,
    versionName,
    versionError,
    versionNames,
    versionErrors,
    versionEditorOpen,
    pendingVersionDelete,
    pendingGroupDelete,
    isOpen,
    renderedDescription,
    close,
    onKeydown,
    selectVersion,
    startCreateVersion,
    cancelVersionEdit,
    saveVersion,
    saveVersionName,
    setDefault,
    openPhases,
    requestDeleteVersion,
    confirmDeleteVersion,
    requestDeleteGroup,
    confirmDeleteGroup,
    updateVersionName
} = useGroupDetailsDialog({
    getDialogHeight: () => dialog.value?.offsetHeight ?? 0,
    getResizeElement: () => dialog.value,
    focusNameInput: () => metadataForm.value?.focusNameInput()
});
</script>

<template>
    <div
        v-if="isOpen && group"
        ref="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="group-details-dialog-title"
        class="fixed bottom-0 left-1/2 z-[9999] flex max-h-[90vh] w-[min(42rem,calc(100vw-2rem))] -translate-x-1/2 flex-col overflow-hidden rounded-t-2xl border border-gray-100 bg-white shadow-xl"
        @dblclick.stop
        @keydown="onKeydown"
    >
        <GroupDetailsHeader
            :group-name="group.name"
            :pending-group-delete="pendingGroupDelete"
            :read-only="settingsStore.readOnly"
            @delete-group="requestDeleteGroup"
            @close="close"
        />

        <div class="space-y-3 overflow-y-auto px-5 py-3">
            <GroupDetailsMetadataForm
                ref="metadataForm"
                v-model:name="name"
                v-model:color="color"
                v-model:description="description"
                :rendered-description="renderedDescription"
                :read-only="settingsStore.readOnly"
            />

            <GroupVersionsSection
                v-model:version-name="versionName"
                :group="group"
                :versions="versions"
                :active-version-id="groupStore.activeVersionIds[group.id]"
                :read-only="settingsStore.readOnly"
                :version-member-counts="versionMemberCounts"
                :version-names="versionNames"
                :version-errors="versionErrors"
                :version-editor-open="versionEditorOpen"
                :version-error="versionError"
                :pending-version-delete="pendingVersionDelete"
                @create-version="startCreateVersion"
                @update-version-name="updateVersionName"
                @save-version="saveVersion"
                @cancel-version-edit="cancelVersionEdit"
                @select-version="selectVersion"
                @save-version-name="saveVersionName"
                @open-phases="openPhases"
                @set-default="setDefault"
                @request-delete-version="requestDeleteVersion"
                @confirm-delete-version="confirmDeleteVersion"
                @cancel-delete-version="pendingVersionDelete = null"
            />

            <GroupDetailsDeletePrompt
                v-if="pendingGroupDelete"
                :group-name="group.name"
                @confirm="confirmDeleteGroup"
                @cancel="pendingGroupDelete = false"
            />
        </div>
    </div>
</template>
