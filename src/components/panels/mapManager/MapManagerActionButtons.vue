<script setup lang="ts">
const emit = defineEmits<{
    newMap: [];
    copyMap: [];
    loadFile: [];
    saveFile: [];
    exportGeoJson: [];
}>();
</script>

<template>
    <div class="flex gap-1.5">
        <button
            id="new-map"
            type="button"
            aria-label="Create a new map"
            title="Create a new map"
            class="w-12 h-12 rounded-xl flex items-center justify-center bg-slate-50 hover:bg-green-100 border border-gray-100 focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:outline-none [touch-action:manipulation] cursor-pointer select-none"
            @click.stop="emit('newMap')"
        >
            <img
                src="../../../img/add-document-svgrepo-com.svg"
                width="28"
                height="28"
                alt=""
                aria-hidden="true"
                class="w-7 h-7 object-contain pointer-events-none"
            />
        </button>
        <button
            id="copy-map"
            type="button"
            aria-label="Make a copy of this map"
            title="Make a copy of this map"
            class="w-12 h-12 rounded-xl flex items-center justify-center bg-slate-50 hover:bg-green-100 border border-gray-100 focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:outline-none [touch-action:manipulation] cursor-pointer select-none"
            @click.stop="emit('copyMap')"
        >
            <img
                src="../../../img/copy-file-svgrepo-com.svg"
                width="28"
                height="28"
                alt=""
                aria-hidden="true"
                class="w-7 h-7 object-contain pointer-events-none"
            />
        </button>
        <button
            id="load-file"
            type="button"
            aria-label="Load a map from a JSON file"
            title="Load a map from a JSON file"
            class="w-12 h-12 rounded-xl flex items-center justify-center bg-slate-50 hover:bg-green-100 border border-gray-100 focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:outline-none [touch-action:manipulation] cursor-pointer select-none"
            @click.stop="emit('loadFile')"
        >
            <img
                src="../../../img/folder-svgrepo-com.svg"
                width="28"
                height="28"
                alt=""
                aria-hidden="true"
                class="w-7 h-7 object-contain pointer-events-none"
            />
        </button>
        <button
            id="save-file"
            type="button"
            aria-label="Save map to a JSON file"
            title="Save map to a JSON file"
            class="w-12 h-12 rounded-xl flex items-center justify-center bg-slate-50 hover:bg-green-100 border border-gray-100 focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:outline-none [touch-action:manipulation] cursor-pointer select-none"
            @click.stop="emit('saveFile')"
        >
            <img
                src="../../../img/save-svgrepo-com.svg"
                width="28"
                height="28"
                alt=""
                aria-hidden="true"
                class="w-7 h-7 object-contain pointer-events-none"
            />
        </button>
        <button
            id="save-geojson-file"
            type="button"
            aria-label="Export map to GeoJSON"
            title="Export map to GeoJSON"
            class="w-12 h-12 rounded-xl flex items-center justify-center bg-slate-50 hover:bg-green-100 border border-gray-100 focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:outline-none [touch-action:manipulation] cursor-pointer select-none"
            @click.stop="emit('exportGeoJson')"
        >
            <img
                src="../../../img/geojson-file-svgrepo-com.svg"
                width="28"
                height="28"
                alt=""
                aria-hidden="true"
                class="w-7 h-7 object-contain pointer-events-none"
            />
        </button>
    </div>
</template>
