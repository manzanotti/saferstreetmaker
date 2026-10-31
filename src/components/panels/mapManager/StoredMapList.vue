<script setup lang="ts">
defineProps<{
    maps: string[];
    currentTitle: string;
}>();

const emit = defineEmits<{
    load: [mapName: string];
    delete: [mapName: string];
}>();
</script>

<template>
    <div v-if="maps.length > 0" id="map-list">
        <p class="text-sm font-medium text-gray-700 mb-1">Maps stored in your browser</p>
        <p class="text-xs text-gray-400 italic mb-2">Click a name to load that map</p>
        <ul class="space-y-1">
            <li
                v-for="mapName in maps"
                :key="mapName"
                class="local-map flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50"
            >
                <template v-if="mapName === currentTitle">
                    <span class="text-sm font-semibold text-gray-800">{{ mapName }} (current)</span>
                </template>
                <template v-else>
                    <span
                        role="button"
                        tabindex="0"
                        class="text-sm text-gray-700 cursor-pointer truncate"
                        @click.stop="emit('load', mapName)"
                        @keydown.enter.prevent="emit('load', mapName)"
                        @keydown.space.prevent="emit('load', mapName)"
                        >{{ mapName }}</span
                    >
                    <button
                        type="button"
                        class="delete-button shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-slate-50 hover:bg-red-50 border border-gray-100 focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:outline-none touch-manipulation cursor-pointer"
                        :aria-label="`Delete ${mapName}`"
                        :title="`Delete ${mapName}`"
                        @click.stop="emit('delete', mapName)"
                    ></button>
                </template>
            </li>
        </ul>
    </div>
</template>
