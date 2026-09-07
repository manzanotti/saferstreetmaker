<script setup lang="ts">
import type { GeoJsonPropertyPreview } from '../../features/map/importedGeoJson';

defineProps<{
    layerName: string;
    nameProperty: string | null;
    namePropertyOptions: string[];
    propertyPreview: GeoJsonPropertyPreview[];
}>();

const emit = defineEmits<{
    'update:layerName': [name: string];
    'update:nameProperty': [nameProperty: string | null];
}>();
</script>

<template>
    <div class="space-y-3">
        <div>
            <label for="imported-layer-name" class="block text-sm font-medium text-gray-700 mb-1"
                >Layer name</label
            >
            <input
                id="imported-layer-name"
                :value="layerName"
                type="text"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                @input="emit('update:layerName', ($event.target as HTMLInputElement).value)"
            />
        </div>
        <div>
            <label for="imported-name-property" class="block text-sm font-medium text-gray-700 mb-1"
                >Feature name field</label
            >
            <select
                id="imported-name-property"
                :value="nameProperty"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none"
                @change="
                    emit('update:nameProperty', ($event.target as HTMLSelectElement).value || null)
                "
            >
                <option :value="null">None</option>
                <option v-for="property in namePropertyOptions" :key="property" :value="property">
                    {{ property }}
                </option>
            </select>
        </div>
        <div
            v-if="propertyPreview.length"
            id="geojson-property-preview"
            class="rounded-lg bg-slate-50 p-3"
        >
            <p class="text-xs font-medium uppercase tracking-wide text-gray-500 mb-2">
                First feature properties
            </p>
            <dl class="space-y-1">
                <div
                    v-for="property in propertyPreview"
                    :key="property.key"
                    class="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-2"
                >
                    <dt class="font-medium text-gray-700 truncate">
                        {{ property.key }}
                    </dt>
                    <dd class="text-gray-600 wrap-break-word">
                        {{ property.displayValue }}
                    </dd>
                </div>
            </dl>
        </div>
    </div>
</template>
