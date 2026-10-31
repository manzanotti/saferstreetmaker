<script setup lang="ts">
import { vMovablePanel } from '../../../directives/movablePanel';
import { computed, onBeforeUnmount, useTemplateRef, watch } from 'vue';
import { useGroupStore } from '../../../stores/groupStore';
import { useUiStore } from '../../../stores/uiStore';
import {
    clearGroupSelection,
    clearReadOnlyGroupPresentation,
    fitGroupFeatures,
    stopReadOnlyGroupPlayback
} from '../../../composables/useGroups';
import { useDialogFeatureFitting } from '../../../composables/groups/useDialogFeatureFitting';
import { getGroupVersions } from '../../../features/groups/groupVersions';
import { sanitizeGroupDescription } from '../../../features/groups/groupDescription';
import ReadOnlyGroupVersionsSection from './ReadOnlyGroupVersionsSection.vue';
import ReadOnlyGroupPhasesSection from './ReadOnlyGroupPhasesSection.vue';

const groupStore = useGroupStore();
const uiStore = useUiStore();
const group = computed(() =>
    groupStore.groups.find((item) => item.id === groupStore.detailsGroupId)
);
const versions = computed(() => (group.value ? getGroupVersions(group.value) : []));
const activeVersion = computed(() =>
    group.value
        ? (versions.value.find(
              (version) => version.id === groupStore.activeVersionIds[group.value!.id]
          ) ?? versions.value[0])
        : null
);
const phases = computed(() => activeVersion.value?.phases ?? []);
const phaseHeading = computed(() =>
    versions.value.length === 1
        ? 'Implementation Phases'
        : `Phases for ${activeVersion.value?.name ?? ''}`
);
const isOpen = computed(() => Boolean(group.value));
const dialog = useTemplateRef<HTMLDivElement>('dialog');
const renderedDescription = computed(() =>
    sanitizeGroupDescription(group.value?.description ?? '')
);

useDialogFeatureFitting({
    isOpen,
    getDialogElement: () => dialog.value,
    fitFeatures: () => fitGroupFeatures(dialog.value?.offsetHeight ?? 0)
});

watch(
    () => uiStore.activePanel,
    (panel) => {
        if (panel === 'groups') {
            close();
        }
    }
);

watch(
    [() => group.value?.id, () => activeVersion.value?.id],
    ([groupId, versionId]) => {
        uiStore.setLegendLayerIds(
            groupId && versionId && activeVersion.value
                ? new Set(activeVersion.value.members.map((member) => member.layerId))
                : null
        );
    },
    { immediate: true }
);

onBeforeUnmount(() => uiStore.setLegendLayerIds(null));

function close() {
    stopReadOnlyGroupPlayback();
    clearReadOnlyGroupPresentation();
    uiStore.setLegendLayerIds(null);
    clearGroupSelection();
    groupStore.closePhasesDialog();
    groupStore.closeDetailsDialog();
}
</script>

<template>
    <div
        v-movable-panel
        v-if="isOpen && group"
        ref="dialog"
        role="dialog"
        aria-modal="true"
        :aria-label="group.name"
        class="fixed bottom-0 left-1/2 z-[9999] flex max-h-[90vh] w-[min(21rem,calc(100vw-2rem))] -translate-x-1/2 flex-col overflow-hidden rounded-t-2xl border border-gray-100 bg-white shadow-xl"
    >
        <div class="flex items-center justify-between border-b border-gray-100 px-5 py-3">
            <h2 class="text-base font-semibold text-gray-800">{{ group.name }}</h2>
            <button
                type="button"
                aria-label="Close group details"
                class="rounded text-gray-400 hover:text-gray-600"
                @click="close"
            >
                <span aria-hidden="true" class="text-xl leading-none">&times;</span>
            </button>
        </div>

        <div class="space-y-3 overflow-y-auto px-5 py-3">
            <section v-if="renderedDescription" aria-label="Description">
                <div
                    class="group-description-content rounded border border-gray-100 bg-slate-50 px-3 py-2 text-sm leading-relaxed text-gray-600"
                    v-html="renderedDescription"
                ></div>
            </section>

            <ReadOnlyGroupVersionsSection
                v-if="versions.length > 1"
                :group="group"
                :versions="versions"
            />

            <section
                v-if="phases.length === 1"
                aria-label="Phase summary"
                class="text-sm text-gray-600"
            >
                Implemented in one phase
            </section>
            <ReadOnlyGroupPhasesSection
                v-else-if="phases.length > 1"
                :phases="phases"
                :phase-heading="phaseHeading"
            />
        </div>
    </div>
</template>

<style scoped>
.group-description-content :deep(p),
.group-description-content :deep(h3),
.group-description-content :deep(h4),
.group-description-content :deep(blockquote),
.group-description-content :deep(pre),
.group-description-content :deep(ul),
.group-description-content :deep(ol) {
    margin: 0.35rem 0;
}
.group-description-content :deep(ul),
.group-description-content :deep(ol) {
    padding-left: 1.25rem;
}
.group-description-content :deep(ul) {
    list-style: disc;
}
.group-description-content :deep(ol) {
    list-style: decimal;
}
.group-description-content :deep(a) {
    color: #047857;
    text-decoration: underline;
}
</style>
