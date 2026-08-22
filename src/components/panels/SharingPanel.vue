<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue';
import { useSettingsStore } from '../../stores/settingsStore';
import { useMapStore } from '../../stores/mapStore';
import { useUiStore } from '../../stores/uiStore';
import { useGroupStore } from '../../stores/groupStore';
import { useSelectionStore } from '../../stores/selectionStore';
import { getFileManager } from '../../composables/useMapManager';
import { getGroupVersions } from '../../features/groups/groupVersions';
import type { Group } from '../../models/Group';
import type { IMapLayer } from '../../composables/layers/IMapLayer';

const settingsStore = useSettingsStore();
const mapStore = useMapStore();
const uiStore = useUiStore();
const groupStore = useGroupStore();
const selectionStore = useSelectionStore();

const mapSize = mapStore.map?.getSize();
const width = ref<number | null>(mapSize ? Math.round(mapSize.x) : null);
const height = ref<number | null>(mapSize ? Math.round(mapSize.y) : null);
const hideToolbar = ref(false);
const showCopiedMessage = ref(false);
const shareScopeGroup = ref<Group | null>(null);
const scopePrompt = useTemplateRef<HTMLDivElement>('scopePrompt');
const scopePromptTrigger = ref<HTMLElement | null>(null);

function onCreate() {
    if (width.value === null || height.value === null || width.value <= 0 || height.value <= 0) {
        return;
    }

    const selectedGroup = groupStore.groups.find(
        (group) => group.id === selectionStore.selectedGroupId
    );
    if (selectedGroup && shareScopeGroup.value === null) {
        scopePromptTrigger.value =
            document.activeElement instanceof HTMLElement ? document.activeElement : null;
        shareScopeGroup.value = selectedGroup;
        return;
    }

    createShare('all', selectedGroup);
}

function createShare(scope: 'all' | 'group', selectedGroup: Group | undefined) {
    if (width.value === null || height.value === null || width.value <= 0 || height.value <= 0) {
        return;
    }

    const groupForShare = shareScopeGroup.value ?? selectedGroup;
    const layers =
        scope === 'group' && groupForShare ? getGroupLayers(groupForShare) : mapStore.toLayers();

    const mapHash = getFileManager().saveMapToHash(
        settingsStore.toSettings(),
        layers,
        scope === 'group' && groupForShare ? [groupForShare] : groupStore.groups
    );
    const baseUrl = window.location.origin + window.location.pathname;
    const params = new URLSearchParams({ 'hide-toolbar': String(hideToolbar.value) });
    if (groupForShare) {
        const versions = getGroupVersions(groupForShare);
        const activeVersionId = groupStore.activeVersionIds[groupForShare.id];
        const versionIndex = versions.findIndex((version) => version.id === activeVersionId);
        params.set('group', groupForShare.id);
        if (versionIndex >= 0) {
            params.set('version', String(versionIndex + 1));
        }
    }
    const html = `<iframe src="${baseUrl}?${params.toString()}#${mapHash}" width="${width.value}" height="${height.value}" title="Safer Street Maker map"></iframe>`;

    if (!navigator.clipboard) {
        showCopiedMessage.value = false;
        return;
    }

    navigator.clipboard
        .writeText(html)
        .then(() => {
            shareScopeGroup.value = null;
            showCopiedMessage.value = true;
        })
        .catch((err) => {
            showCopiedMessage.value = false;
            console.warn('Clipboard write failed:', err);
        });
}

function getGroupLayers(group: Group): Map<string, IMapLayer> {
    const memberKeys = new Set(
        getGroupVersions(group).flatMap((version) =>
            version.members.map((member) => `${member.layerId}:${member.historyId}`)
        )
    );
    const layers = new Map<string, IMapLayer>();
    mapStore.toLayers().forEach((layer, layerId) => {
        const geoJson = layer.toGeoJSON() as unknown as GeoJSON.FeatureCollection;
        layers.set(layerId, {
            ...layer,
            toGeoJSON: () => ({
                ...geoJson,
                features: (geoJson.features ?? []).filter((feature) =>
                    memberKeys.has(`${layerId}:${String(feature.properties?.historyId ?? '')}`)
                )
            })
        });
    });
    return layers;
}

function cancelScopePrompt() {
    shareScopeGroup.value = null;
}

function restoreScopePromptFocus() {
    const trigger = scopePromptTrigger.value;
    scopePromptTrigger.value = null;
    if (trigger?.isConnected) {
        trigger.focus();
    }
}

function onScopePromptKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
        event.preventDefault();
        cancelScopePrompt();
        return;
    }
    if (event.key !== 'Tab' || !scopePrompt.value) {
        return;
    }

    const focusable = Array.from(
        scopePrompt.value.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
    ).filter((element) => !element.hasAttribute('disabled'));
    if (focusable.length === 0) {
        event.preventDefault();
        scopePrompt.value.focus();
        return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
}

watch(shareScopeGroup, (group) => {
    if (group) {
        void nextTick(() => scopePrompt.value?.querySelector<HTMLElement>('button')?.focus());
    } else {
        void nextTick(restoreScopePromptFocus);
    }
});

onBeforeUnmount(restoreScopePromptFocus);

function onClose() {
    uiStore.closePanel();
}
</script>

<template>
    <div
        v-if="shareScopeGroup"
        ref="scopePrompt"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="sharing-scope-title"
        class="fixed inset-0 z-[10003] flex items-center justify-center bg-black/30 p-4"
        tabindex="-1"
        @keydown="onScopePromptKeydown"
    >
        <div class="w-80 rounded-xl bg-white p-5 shadow-xl">
            <h2 id="sharing-scope-title" class="text-base font-semibold text-gray-800">
                Share {{ shareScopeGroup.name }}
            </h2>
            <p class="mt-2 text-sm text-gray-600">
                Include the whole map or just this selected group?
            </p>
            <div class="mt-5 flex flex-col gap-2">
                <button
                    type="button"
                    class="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800"
                    @click="createShare('all', shareScopeGroup)"
                >
                    Whole map
                </button>
                <button
                    type="button"
                    class="rounded-lg border border-gray-200 bg-slate-50 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-slate-100"
                    @click="createShare('group', shareScopeGroup)"
                >
                    Just {{ shareScopeGroup.name }}
                </button>
                <button
                    type="button"
                    class="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700"
                    @click="cancelScopePrompt"
                >
                    Cancel
                </button>
            </div>
        </div>
    </div>
    <div
        role="dialog"
        aria-labelledby="sharing-panel-title"
        class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[10002]"
        @dblclick.stop
    >
        <form
            id="sharing"
            class="relative rounded-2xl bg-white shadow-xl border border-gray-100 w-72 flex flex-col overflow-hidden"
            @submit.prevent="onCreate"
        >
            <div class="flex items-center px-5 py-4 border-b border-gray-100 shrink-0">
                <h2 id="sharing-panel-title" class="text-base font-semibold text-gray-800">
                    Share map
                </h2>
            </div>

            <div class="px-5 py-4 space-y-4">
                <div>
                    <label for="width" class="block text-sm font-medium text-gray-700 mb-1"
                        >Width</label
                    >
                    <div class="flex items-center gap-2">
                        <input
                            id="width"
                            v-model.number="width"
                            type="number"
                            required
                            class="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-800 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                        />
                        <span class="text-sm text-gray-500">px</span>
                    </div>
                </div>

                <div>
                    <label for="height" class="block text-sm font-medium text-gray-700 mb-1"
                        >Height</label
                    >
                    <div class="flex items-center gap-2">
                        <input
                            id="height"
                            v-model.number="height"
                            type="number"
                            required
                            class="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-800 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                        />
                        <span class="text-sm text-gray-500">px</span>
                    </div>
                </div>

                <div class="toggle">
                    <div class="form-check form-switch toggle-row">
                        <label
                            class="form-check-label toggle-label text-sm font-medium text-gray-700"
                            for="hide-toolbar"
                            >Hide toolbar</label
                        >
                        <input
                            id="hide-toolbar"
                            v-model="hideToolbar"
                            type="checkbox"
                            role="switch"
                        />
                    </div>
                </div>

                <p
                    id="messageRow"
                    class="text-sm text-green-700 font-medium"
                    :class="{ hidden: !showCopiedMessage }"
                >
                    Copied to clipboard
                </p>
            </div>

            <div
                class="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 shrink-0"
            >
                <button
                    type="button"
                    class="rounded-lg bg-slate-50 hover:bg-slate-100 border border-gray-200 text-gray-700 px-4 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-1 focus-visible:outline-none [touch-action:manipulation]"
                    @click="onClose"
                >
                    Close
                </button>
                <button
                    type="submit"
                    class="rounded-lg bg-green-700 hover:bg-green-800 text-white px-4 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-1 focus-visible:outline-none [touch-action:manipulation]"
                >
                    Create
                </button>
            </div>
        </form>
    </div>
</template>
