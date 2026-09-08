<script setup lang="ts">
import { ref } from 'vue';
import { useMapStore } from '../../stores/mapStore';
import { useSettingsStore } from '../../stores/settingsStore';
import type { ToolbarButton } from '../../models/ToolbarButton';
import { useLayerToolbarItems } from '../../composables/toolbar/useLayerToolbarItems';
import { useToolbarDockScale } from '../../composables/toolbar/useToolbarDockScale';
import { useToolbarSubmenus } from '../../composables/toolbar/useToolbarSubmenus';
import LayerToolbarButton from './LayerToolbarButton.vue';

const mapStore = useMapStore();
const settingsStore = useSettingsStore();
const lastSelectedByGroup = ref<Record<string, string>>({});
const { layerItems } = useLayerToolbarItems(lastSelectedByGroup);
const { openSubmenus, showSubmenu, hideSubmenu, onTouchStart, cancelLongPress } =
    useToolbarSubmenus(() => mapStore.map);
const { toolbarRef, buttonScales, registerDockButton, onDockMouseMove, onDockMouseLeave } =
    useToolbarDockScale();

// ── Button click handlers ──────────────────────────────────────────────────
function onLayerButtonClick(btn: ToolbarButton) {
    const map = mapStore.map;
    if (!map) {
        return;
    }

    btn.action(new Event('click'), map);

    const newId = mapStore.drawLayerId === btn.id ? null : btn.id;
    mapStore.setDrawLayer(newId);

    // When a layer tool is toggled off, return focus to the document body so
    // keyboard shortcuts (e.g. 's') remain immediately usable without the
    // user having to click elsewhere first.
    if (newId === null) {
        (document.activeElement as HTMLElement | null)?.blur();
    }

    if (btn.groupName) {
        // Record which group button was last activated (not when toggling off).
        if (newId !== null) {
            lastSelectedByGroup.value = { ...lastSelectedByGroup.value, [btn.groupName]: btn.id };
        }
        hideSubmenu(btn.groupName);
    }
}
</script>

<template>
    <ul
        v-if="!settingsStore.hideToolbar && !settingsStore.readOnly"
        ref="toolbarRef"
        role="toolbar"
        aria-label="Map tools"
        aria-orientation="vertical"
        class="toolbar flex flex-col gap-1.5 p-[3px] rounded-2xl bg-white/[0.94] shadow-xl border border-white/60 w-fit overflow-visible"
        @mousemove="onDockMouseMove"
        @mouseleave="onDockMouseLeave"
    >
        <!-- Layer buttons (single + grouped) -->
        <template
            v-for="item in layerItems"
            :key="item.type === 'group' ? item.groupName : item.button.id"
        >
            <!-- Single layer button -->
            <li v-if="item.type === 'single'">
                <LayerToolbarButton
                    :button="item.button"
                    :active="mapStore.drawLayerId === item.button.id"
                    :scale="buttonScales[item.button.id] ?? 1"
                    docked
                    @activate="onLayerButtonClick(item.button)"
                    @register="registerDockButton"
                />
            </li>

            <!-- Grouped layer button with submenu -->
            <li
                v-else-if="item.type === 'group'"
                class="group relative"
                @touchstart="onTouchStart(item.groupName)"
                @touchend="cancelLongPress(item.groupName)"
                @touchcancel="cancelLongPress(item.groupName)"
                @touchmove="cancelLongPress(item.groupName)"
            >
                <!-- Parent button -->
                <LayerToolbarButton
                    :button="item.parent"
                    :active="mapStore.drawLayerId === item.parent.id"
                    :expanded="openSubmenus[item.groupName] ?? false"
                    :scale="buttonScales[item.parent.id] ?? 1"
                    docked
                    show-submenu-indicator
                    @activate="onLayerButtonClick(item.parent)"
                    @show-submenu="showSubmenu(item.groupName)"
                    @hide-submenu="hideSubmenu(item.groupName)"
                    @register="registerDockButton"
                />

                <!-- Submenu -->
                <Transition
                    enter-active-class="transition-[opacity,transform] duration-200 ease-out"
                    enter-from-class="opacity-0 -translate-x-1"
                    enter-to-class="opacity-100 translate-x-0"
                    leave-active-class=""
                    leave-from-class=""
                    leave-to-class=""
                >
                    <ul
                        v-show="openSubmenus[item.groupName]"
                        role="group"
                        :aria-label="`${item.groupName} options`"
                        aria-orientation="horizontal"
                        class="subToolbar absolute left-full -top-[3px] ml-1.5 flex flex-row gap-1.5 p-[3px] rounded-xl bg-white/[0.94] shadow-xl border border-white/60"
                    >
                        <li v-for="subBtn in item.sub" :key="subBtn.id">
                            <LayerToolbarButton
                                :button="subBtn"
                                :active="mapStore.drawLayerId === subBtn.id"
                                @activate="onLayerButtonClick(subBtn)"
                            />
                        </li>
                    </ul>
                </Transition>
            </li>
        </template>
    </ul>
</template>
