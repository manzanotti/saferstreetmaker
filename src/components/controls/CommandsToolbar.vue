<script setup lang="ts">
import { computed } from 'vue';
import { getMapManager } from '../../composables/useMapManager';
import { useHistoryStore } from '../../stores/historyStore';
import { useSelectionStore } from '../../stores/selectionStore';
import { useUiStore, type PanelId } from '../../stores/uiStore';
import { useSettingsStore } from '../../stores/settingsStore';

const historyStore = useHistoryStore();
const selectionStore = useSelectionStore();
const uiStore = useUiStore();
const settingsStore = useSettingsStore();
const areaSelectIcon = new URL('../../img/area-select.svg', import.meta.url).href;
const mapManagerIconSrc = new URL('../../img/folder-svgrepo-com.svg', import.meta.url).href;
const groupIconSrc = new URL('../../img/group.svg', import.meta.url).href;

interface PanelButtonDef {
    id: string;
    panelId: PanelId;
    tooltip: string;
    iconSrc: string;
}

/** Settings, share and help — rendered after the history/select buttons. */
const panelButtons: PanelButtonDef[] = [
    {
        id: 'groups',
        panelId: 'groups',
        tooltip: 'Manage groups',
        iconSrc: groupIconSrc
    },
    {
        id: 'settings',
        panelId: 'settings',
        tooltip: 'Open settings',
        iconSrc: new URL('../../img/settings-svgrepo-com.svg', import.meta.url).href
    },
    {
        id: 'share',
        panelId: 'sharing',
        tooltip: 'Share map',
        iconSrc: new URL('../../img/share-svgrepo-com.svg', import.meta.url).href
    },
    {
        id: 'help',
        panelId: 'help',
        tooltip: 'Open help',
        iconSrc: new URL('../../img/help-svgrepo-com.svg', import.meta.url).href
    }
];
const visiblePanelButtons = computed(() =>
    panelButtons.filter((button) => button.id !== 'groups' || !settingsStore.readOnly)
);

async function onUndo() {
    await getMapManager().undo();
}

async function onRedo() {
    await getMapManager().redo();
}

function onPanelButtonClick(panelId: PanelId) {
    if (uiStore.activePanel === panelId) {
        uiStore.closePanel();
    } else {
        uiStore.openPanel(panelId);
    }
}
</script>

<template>
    <ul
        role="toolbar"
        aria-label="Map controls"
        class="flex flex-wrap sm:flex-nowrap gap-1 sm:gap-1.5 p-[3px] rounded-2xl bg-white/[0.94] shadow-xl border border-white/60 w-fit"
    >
        <!-- Map manager — first button in the bar -->
        <li v-if="!settingsStore.readOnly">
            <button
                id="map-manager-button"
                type="button"
                aria-label="Manage maps"
                title="Manage maps"
                :aria-pressed="uiStore.activePanel === 'mapManager'"
                :class="[
                    'w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center',
                    'transition-transform duration-150 ease-out',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-1',
                    '[touch-action:manipulation] cursor-pointer select-none',
                    uiStore.activePanel === 'mapManager'
                        ? 'bg-green-700 shadow-inner'
                        : 'bg-slate-50 hover:bg-green-100'
                ]"
                @click.stop="onPanelButtonClick('mapManager')"
            >
                <img
                    :src="mapManagerIconSrc"
                    width="28"
                    height="28"
                    alt=""
                    aria-hidden="true"
                    class="w-5 h-5 sm:w-7 sm:h-7 object-contain pointer-events-none"
                    :class="{ invert: uiStore.activePanel === 'mapManager' }"
                />
            </button>
        </li>
        <!-- Undo -->
        <li v-if="!settingsStore.readOnly">
            <button
                id="undo-button"
                type="button"
                aria-label="Undo"
                title="Undo"
                :disabled="historyStore.busy || !historyStore.canUndo"
                class="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-xl sm:text-2xl font-semibold bg-slate-50 hover:bg-green-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-1 [touch-action:manipulation] cursor-pointer select-none transition-transform duration-150 ease-out disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-slate-50"
                @click.stop="onUndo"
            >
                <span aria-hidden="true">&#x21B6;</span>
            </button>
        </li>
        <!-- Redo -->
        <li v-if="!settingsStore.readOnly">
            <button
                id="redo-button"
                type="button"
                aria-label="Redo"
                title="Redo"
                :disabled="historyStore.busy || !historyStore.canRedo"
                class="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-xl sm:text-2xl font-semibold bg-slate-50 hover:bg-green-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-1 [touch-action:manipulation] cursor-pointer select-none transition-transform duration-150 ease-out disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-slate-50"
                @click.stop="onRedo"
            >
                <span aria-hidden="true">&#x21B7;</span>
            </button>
        </li>
        <!-- Area select -->
        <li v-if="!settingsStore.readOnly">
            <button
                id="select-area-button"
                type="button"
                aria-label="Select features in an area"
                title="Select features in an area"
                :aria-pressed="selectionStore.isActive"
                :class="[
                    'w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center',
                    'transition-transform duration-150 ease-out',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-1',
                    '[touch-action:manipulation] cursor-pointer select-none',
                    selectionStore.isActive
                        ? 'bg-green-700 shadow-inner'
                        : 'bg-slate-50 hover:bg-green-100'
                ]"
                @click.stop="
                    selectionStore.isActive
                        ? selectionStore.deactivate()
                        : selectionStore.activate()
                "
            >
                <img
                    :src="areaSelectIcon"
                    width="28"
                    height="28"
                    alt=""
                    aria-hidden="true"
                    class="w-5 h-5 sm:w-7 sm:h-7 object-contain pointer-events-none"
                    :class="{ invert: selectionStore.isActive }"
                />
            </button>
        </li>
        <!-- Line-break on mobile: forces groups/settings/share/help onto a second row -->
        <li class="basis-full sm:hidden" aria-hidden="true"></li>
        <!-- Settings, share, help -->
        <li v-for="mb in visiblePanelButtons" :key="mb.id">
            <button
                :id="`${mb.id}-button`"
                type="button"
                :aria-label="mb.tooltip"
                :title="mb.tooltip"
                :aria-pressed="uiStore.activePanel === mb.panelId"
                :class="[
                    'w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center',
                    'transition-transform duration-150 ease-out',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-1',
                    '[touch-action:manipulation] cursor-pointer select-none',
                    uiStore.activePanel === mb.panelId
                        ? 'bg-green-700 shadow-inner'
                        : 'bg-slate-50 hover:bg-green-100'
                ]"
                @click.stop="onPanelButtonClick(mb.panelId)"
            >
                <img
                    :src="mb.iconSrc"
                    width="28"
                    height="28"
                    alt=""
                    aria-hidden="true"
                    class="w-5 h-5 sm:w-7 sm:h-7 object-contain pointer-events-none"
                    :class="{ invert: uiStore.activePanel === mb.panelId }"
                />
            </button>
        </li>
    </ul>
</template>
