<script setup lang="ts">
import type { GroupPhase } from '../../../models/Group';
import { useGroupStore } from '../../../stores/groupStore';
import {
    focusReadOnlyGroupPhase,
    startReadOnlyGroupPlayback,
    stopReadOnlyGroupPlayback,
    stepReadOnlyGroupPhase
} from '../../../composables/useGroups';

defineProps<{
    phases: GroupPhase[];
    phaseHeading: string;
}>();

const groupStore = useGroupStore();

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
    <section aria-labelledby="read-only-group-phases-title">
        <div class="flex items-center justify-between">
            <h3 id="read-only-group-phases-title" class="text-sm font-semibold text-gray-800">
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
                :aria-label="groupStore.playbackPlaying ? 'Stop phase playback' : 'Play phases'"
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
</template>
