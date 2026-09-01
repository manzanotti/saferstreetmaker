<script setup lang="ts">
import type { ImportedGeoJsonLayer } from '../../models/ImportedGeoJsonLayer';

defineProps<{
    layers: ImportedGeoJsonLayer[];
    readOnly?: boolean;
}>();

defineEmits<{
    add: [];
    delete: [id: string];
    toggleVisibility: [id: string];
    rename: [id: string, name: string];
}>();
</script>

<template>
    <section id="layers-section" class="space-y-2">
        <div class="flex justify-end">
            <button
                v-if="!readOnly"
                id="add-layer-button"
                type="button"
                class="rounded-lg bg-green-700 hover:bg-green-800 text-white px-3 py-1.5 text-sm font-medium focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-1 focus-visible:outline-none touch-manipulation"
                @click.stop="$emit('add')"
            >
                Add layer
            </button>
        </div>
        <p v-if="layers.length === 0" id="layers-empty" class="text-xs text-gray-400 italic">
            No imported layers yet.
        </p>
        <ul v-else id="layers-list" class="space-y-1">
            <li
                v-for="layer in layers"
                :key="layer.id"
                class="layer-item flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50"
            >
                <input
                    :value="layer.name"
                    type="text"
                    :disabled="readOnly"
                    class="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-1 text-sm text-gray-700 focus:border-gray-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                    :aria-label="`Rename ${layer.name}`"
                    @change="$emit('rename', layer.id, ($event.target as HTMLInputElement).value)"
                />
                <button
                    type="button"
                    class="flex h-7 w-7 shrink-0 items-center justify-center rounded text-gray-500 hover:bg-slate-100"
                    :aria-label="
                        layer.visible === false
                            ? `Show layer ${layer.name}`
                            : `Hide layer ${layer.name}`
                    "
                    :title="
                        layer.visible === false
                            ? `Show layer ${layer.name}`
                            : `Hide layer ${layer.name}`
                    "
                    @click.stop="$emit('toggleVisibility', layer.id)"
                >
                    <svg
                        v-if="layer.visible === false"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        class="h-4 w-4"
                        aria-hidden="true"
                    >
                        <path d="M3 3l18 18" />
                        <path
                            d="M10.6 5.1A9.7 9.7 0 0 1 12 5c6.5 0 10 7 10 7a13.2 13.2 0 0 1-2.4 3.1M6.5 6.6A13.3 13.3 0 0 0 2 12s3.5 7 10 7a9.6 9.6 0 0 0 4-.9"
                        />
                        <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                    </svg>
                    <svg
                        v-else
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        class="h-4 w-4"
                        aria-hidden="true"
                    >
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                        <circle cx="12" cy="12" r="3" />
                    </svg>
                </button>
                <button
                    v-if="!readOnly"
                    type="button"
                    class="delete-button shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-slate-50 hover:bg-red-50 border border-gray-100 focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:outline-none touch-manipulation cursor-pointer"
                    :aria-label="`Delete ${layer.name}`"
                    :title="`Delete ${layer.name}`"
                    @click.stop="$emit('delete', layer.id)"
                ></button>
            </li>
        </ul>
    </section>
</template>
