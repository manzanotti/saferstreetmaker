<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, useTemplateRef, watch } from 'vue';
import { useGroupStore } from '../../stores/groupStore';
import { useUiStore } from '../../stores/uiStore';
import {
    clearGroupSelection,
    clearReadOnlyGroupPresentation,
    focusReadOnlyGroupPhase,
    fitGroupFeatures,
    startReadOnlyGroupPlayback,
    stopReadOnlyGroupPlayback,
    stepReadOnlyGroupPhase,
    viewGroupVersion
} from '../../composables/useGroups';
import { getGroupVersions, memberKey } from '../../features/groups/groupVersions';
import { sanitizeGroupDescription } from '../../features/groups/groupDescription';

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
let resizeObserver: ResizeObserver | null = null;

function fitFeatures() {
    fitGroupFeatures(dialog.value?.offsetHeight ?? 0);
}

watch(
    isOpen,
    (open) => {
        resizeObserver?.disconnect();
        resizeObserver = null;
        if (open) {
            void nextTick(() => {
                if (dialog.value) {
                    fitFeatures();
                    resizeObserver = new ResizeObserver(fitFeatures);
                    resizeObserver.observe(dialog.value);
                }
            });
        }
    },
    { immediate: true }
);

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

onBeforeUnmount(() => resizeObserver?.disconnect());
onBeforeUnmount(() => uiStore.setLegendLayerIds(null));

function memberCount(version: (typeof versions.value)[number]) {
    return new Set(version.members.map(memberKey)).size;
}

function close() {
    stopReadOnlyGroupPlayback();
    clearReadOnlyGroupPresentation();
    uiStore.setLegendLayerIds(null);
    clearGroupSelection();
    groupStore.closePhasesDialog();
    groupStore.closeDetailsDialog();
}

function viewVersion(versionId: string) {
    if (group.value) {
        viewGroupVersion(group.value.id, versionId);
    }
}

function focusPhase(phaseId: string) {
    focusReadOnlyGroupPhase(phaseId);
}

function play() {
    if (groupStore.playbackPlaying) {
        stopReadOnlyGroupPlayback();
    } else {
        startReadOnlyGroupPlayback();
    }
}
</script>

<template>
    <div
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

            <section v-if="versions.length > 1" aria-labelledby="read-only-group-versions-title">
                <h3
                    id="read-only-group-versions-title"
                    class="mb-2 text-sm font-semibold text-gray-800"
                >
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

            <section
                v-if="phases.length === 1"
                aria-label="Phase summary"
                class="text-sm text-gray-600"
            >
                Implemented in one phase
            </section>
            <section v-else-if="phases.length > 1" aria-labelledby="read-only-group-phases-title">
                <div class="flex items-center justify-between">
                    <h3
                        id="read-only-group-phases-title"
                        class="text-sm font-semibold text-gray-800"
                    >
                        {{ phaseHeading }}
                    </h3>
                    <span v-if="groupStore.playbackPlaying" class="text-xs text-gray-500"
                        >Playing phase {{ (groupStore.playbackPhaseIndex ?? 0) + 1 }}</span
                    >
                </div>
                <div role="list" aria-label="Group phases" class="mt-2 space-y-2">
                    <div
                        v-for="(phase, index) in phases"
                        :key="phase.id"
                        role="listitem"
                        class="flex items-center gap-2 rounded-lg border px-3 py-2"
                        :class="
                            groupStore.focusedPhaseId === phase.id ||
                            (groupStore.playbackPlaying && groupStore.playbackPhaseIndex === index)
                                ? 'border-green-300 bg-green-50'
                                : 'border-gray-200'
                        "
                    >
                        <button
                            type="button"
                            class="min-w-0 flex-1 text-left text-sm font-medium text-gray-700"
                            :aria-label="`View Phase ${index + 1}`"
                            @click="focusPhase(phase.id)"
                        >
                            Phase {{ index + 1 }}
                        </button>
                        <span class="text-xs text-gray-500"
                            >{{ phase.members.length }} feature{{
                                phase.members.length === 1 ? '' : 's'
                            }}</span
                        >
                    </div>
                </div>
                <div class="flex justify-center gap-1 border-t border-gray-100 pt-3">
                    <button
                        type="button"
                        aria-label="Previous phase"
                        title="Previous phase"
                        class="flex h-8 w-8 items-center justify-center rounded border border-gray-200 bg-white text-black hover:bg-gray-50"
                        @click="stepReadOnlyGroupPhase(-1)"
                    >
                        <span aria-hidden="true">|&lt;</span>
                    </button>
                    <button
                        type="button"
                        :aria-label="
                            groupStore.playbackPlaying ? 'Stop phase playback' : 'Play phases'
                        "
                        title="Play phases"
                        class="flex h-8 w-8 items-center justify-center rounded border border-gray-200 bg-white text-black hover:bg-gray-50"
                        @click="play"
                    >
                        <span v-if="groupStore.playbackPlaying" aria-hidden="true">■</span
                        ><span
                            v-else
                            aria-hidden="true"
                            class="h-0 w-0 border-y-[6px] border-y-transparent border-l-[9px] border-l-black"
                        ></span>
                    </button>
                    <button
                        type="button"
                        aria-label="Next phase"
                        title="Next phase"
                        class="flex h-8 w-8 items-center justify-center rounded border border-gray-200 bg-white text-black hover:bg-gray-50"
                        @click="stepReadOnlyGroupPhase(1)"
                    >
                        <span aria-hidden="true">&gt;|</span>
                    </button>
                    <button
                        v-if="groupStore.playbackComplete"
                        type="button"
                        aria-label="Replay phases"
                        title="Replay phases"
                        class="flex h-8 w-8 items-center justify-center rounded border border-gray-200 bg-white text-black hover:bg-gray-50"
                        @click="play"
                    >
                        <span aria-hidden="true">↻</span>
                    </button>
                </div>
            </section>
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
