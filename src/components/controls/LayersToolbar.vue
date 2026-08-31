<script setup lang="ts">
import { computed, ref, reactive, onMounted, onUnmounted } from 'vue';
import { useMapStore } from '../../stores/mapStore';
import { useSettingsStore } from '../../stores/settingsStore';
import type { ToolbarButton } from '../../models/ToolbarButton';

const mapStore = useMapStore();
const settingsStore = useSettingsStore();

// ── Layer button groups ────────────────────────────────────────────────────
interface GroupItem {
    type: 'group';
    parent: ToolbarButton;
    sub: ToolbarButton[];
    groupName: string;
}

interface SingleItem {
    type: 'single';
    button: ToolbarButton;
}

type ToolbarItem = GroupItem | SingleItem;

const layerItems = computed<ToolbarItem[]>(() => {
    if (settingsStore.readOnly) {
        return [];
    }

    const allButtons = mapStore.layers
        .filter((l) => settingsStore.activeLayers.includes(l.id))
        .map((l) => l.getToolbarButton());

    const handledGroups = new Set<string>();
    const items: ToolbarItem[] = [];

    for (const btn of allButtons) {
        if (!btn.groupName) {
            items.push({ type: 'single', button: btn });
            continue;
        }

        if (handledGroups.has(btn.groupName)) {
            continue;
        }
        handledGroups.add(btn.groupName);

        const groupBtns = allButtons.filter((b) => b.groupName === btn.groupName);
        const anchor = groupBtns.find((b) => b.isFirst) ?? groupBtns[0];

        const lastId = lastSelectedByGroup.value[btn.groupName];
        const active =
            groupBtns.find((b) => b.id === mapStore.drawLayerId) ??
            groupBtns.find((b) => b.id === lastId) ??
            anchor;
        const sub = groupBtns.filter((b) => b.id !== active.id);

        items.push({ type: 'group', parent: active, sub, groupName: btn.groupName });
    }

    return items;
});

// ── Last-selected button per group ───────────────────────────────────────
// Keeps the most recently activated button as the visible parent even after
// it is deselected, so the group doesn't snap back to the anchor button.
const lastSelectedByGroup = ref<Record<string, string>>({});

// ── Submenu visibility ─────────────────────────────────────────────────────
const openSubmenus = ref<Record<string, boolean>>({});

function showSubmenu(groupName: string) {
    openSubmenus.value = { ...openSubmenus.value, [groupName]: true };
}

function hideSubmenu(groupName: string) {
    openSubmenus.value = { ...openSubmenus.value, [groupName]: false };
}

/** Collapse every expanded submenu. No-op when none are open. */
function hideAllSubmenus() {
    const anyOpen = Object.values(openSubmenus.value).some(Boolean);
    if (!anyOpen) {
        return;
    }
    openSubmenus.value = {};
}

function onDocumentKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
        hideAllSubmenus();
    }
}

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

// ── Long-press support (mobile) ────────────────────────────────────────────
const longPressTimers: Record<string, ReturnType<typeof setTimeout>> = {};

function onTouchStart(groupName: string) {
    longPressTimers[groupName] = setTimeout(() => {
        delete longPressTimers[groupName];
        showSubmenu(groupName);
    }, 500);
}

function cancelLongPress(groupName: string) {
    clearTimeout(longPressTimers[groupName]);
    delete longPressTimers[groupName];
}

// ── Dock animation ─────────────────────────────────────────────────────────
const toolbarRef = ref<HTMLUListElement | null>(null);
const buttonMap = new Map<string, HTMLButtonElement>();
const buttonRects = new Map<string, DOMRect>();
const buttonScales = reactive<Record<string, number>>({});
const reducedMotion =
    typeof window !== 'undefined'
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false;

function registerDockButton(id: string, el: HTMLButtonElement | null) {
    if (el) {
        buttonMap.set(id, el);
        buttonRects.set(id, el.getBoundingClientRect());
        if (!(id in buttonScales)) {
            buttonScales[id] = 1;
        }
    } else {
        buttonMap.delete(id);
        buttonRects.delete(id);
        delete buttonScales[id];
    }
}

function cacheRects() {
    buttonMap.forEach((el, id) => {
        buttonRects.set(id, el.getBoundingClientRect());
    });
}

const SIGMA = 52;
const MAX_GROW = 0.45;

function dockScale(dist: number): number {
    return 1 + MAX_GROW * Math.exp(-(dist ** 2) / (2 * SIGMA ** 2));
}

function onDockMouseMove(e: MouseEvent) {
    if (reducedMotion) {
        return;
    }
    const y = e.clientY;
    buttonMap.forEach((_, id) => {
        const rect = buttonRects.get(id);
        if (!rect) {
            return;
        }
        const center = rect.top + rect.height / 2;
        buttonScales[id] = dockScale(Math.abs(y - center));
    });
}

function onDockMouseLeave() {
    Object.keys(buttonScales).forEach((id) => {
        buttonScales[id] = 1;
    });
}

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
    cacheRects();
    if (toolbarRef.value) {
        resizeObserver = new ResizeObserver(cacheRects);
        resizeObserver.observe(toolbarRef.value);
    }

    // Collapse an expanded button sub-group when the user clicks on the map
    // or presses Escape.
    mapStore.map?.on('click', hideAllSubmenus);
    document.addEventListener('keydown', onDocumentKeydown);
});

onUnmounted(() => {
    resizeObserver?.disconnect();
    mapStore.map?.off('click', hideAllSubmenus);
    document.removeEventListener('keydown', onDocumentKeydown);
});
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
                <button
                    :id="`${item.button.id}-button`"
                    :ref="
                        (el) => registerDockButton(item.button.id, el as HTMLButtonElement | null)
                    "
                    type="button"
                    :aria-label="item.button.tooltip"
                    :title="item.button.tooltip"
                    :aria-pressed="mapStore.drawLayerId === item.button.id"
                    :style="{ transform: `scale(${buttonScales[item.button.id] ?? 1})` }"
                    :class="[
                        'w-12 h-12 rounded-xl flex items-center justify-center',
                        'transition-transform duration-150 ease-out origin-left',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-1',
                        '[touch-action:manipulation] cursor-pointer select-none',
                        mapStore.drawLayerId === item.button.id
                            ? 'bg-green-700 shadow-inner'
                            : 'bg-slate-50 hover:bg-green-100'
                    ]"
                    @click.stop="onLayerButtonClick(item.button)"
                >
                    <img
                        v-if="item.button.iconSrc"
                        :src="item.button.iconSrc"
                        width="28"
                        height="28"
                        alt=""
                        aria-hidden="true"
                        class="w-7 h-7 object-contain pointer-events-none"
                        :class="{ invert: mapStore.drawLayerId === item.button.id }"
                    />
                    <span
                        v-else-if="item.button.text"
                        aria-hidden="true"
                        class="text-xl font-bold pointer-events-none leading-none"
                        :class="
                            mapStore.drawLayerId === item.button.id ? 'text-white' : 'text-gray-700'
                        "
                        >{{ item.button.text }}</span
                    >
                </button>
            </li>

            <!-- Grouped layer button with submenu -->
            <li
                v-else-if="item.type === 'group'"
                class="group relative"
                @touchstart="onTouchStart(item.groupName)"
                @touchend="cancelLongPress(item.groupName)"
                @touchmove="cancelLongPress(item.groupName)"
            >
                <!-- Parent button -->
                <button
                    :id="`${item.parent.id}-button`"
                    :ref="
                        (el) => registerDockButton(item.parent.id, el as HTMLButtonElement | null)
                    "
                    type="button"
                    :aria-label="item.parent.tooltip"
                    :title="item.parent.tooltip"
                    :aria-pressed="mapStore.drawLayerId === item.parent.id"
                    :aria-expanded="openSubmenus[item.groupName] ?? false"
                    :style="{ transform: `scale(${buttonScales[item.parent.id] ?? 1})` }"
                    :class="[
                        'relative w-12 h-12 rounded-xl flex items-center justify-center',
                        'transition-transform duration-150 ease-out origin-left',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-1',
                        '[touch-action:manipulation] cursor-pointer select-none',
                        mapStore.drawLayerId === item.parent.id
                            ? 'bg-green-700 shadow-inner'
                            : 'bg-slate-50 hover:bg-green-100'
                    ]"
                    @click.stop="onLayerButtonClick(item.parent)"
                    @contextmenu.prevent.stop="showSubmenu(item.groupName)"
                    @keydown.down.prevent="showSubmenu(item.groupName)"
                    @keydown.escape="hideSubmenu(item.groupName)"
                >
                    <img
                        v-if="item.parent.iconSrc"
                        :src="item.parent.iconSrc"
                        width="28"
                        height="28"
                        alt=""
                        aria-hidden="true"
                        class="w-7 h-7 object-contain pointer-events-none"
                        :class="{ invert: mapStore.drawLayerId === item.parent.id }"
                    />
                    <span
                        v-else-if="item.parent.text"
                        aria-hidden="true"
                        class="text-xl font-bold pointer-events-none leading-none"
                        :class="
                            mapStore.drawLayerId === item.parent.id ? 'text-white' : 'text-gray-700'
                        "
                        >{{ item.parent.text }}</span
                    >
                    <!-- Submenu indicator -->
                    <span
                        class="absolute top-0.5 right-0.5 text-base leading-none pointer-events-none font-bold"
                        :class="
                            mapStore.drawLayerId === item.parent.id
                                ? 'text-white/80'
                                : 'text-gray-500'
                        "
                        aria-hidden="true"
                        >&#9656;</span
                    >
                </button>

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
                            <button
                                :id="`${subBtn.id}-button`"
                                type="button"
                                :aria-label="subBtn.tooltip"
                                :title="subBtn.tooltip"
                                :aria-pressed="mapStore.drawLayerId === subBtn.id"
                                :class="[
                                    'w-12 h-12 rounded-xl flex items-center justify-center',
                                    'transition-transform duration-150 ease-out',
                                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-1',
                                    '[touch-action:manipulation] cursor-pointer select-none',
                                    mapStore.drawLayerId === subBtn.id
                                        ? 'bg-green-700 shadow-inner'
                                        : 'bg-slate-50 hover:bg-green-100'
                                ]"
                                @click.stop="onLayerButtonClick(subBtn)"
                            >
                                <img
                                    v-if="subBtn.iconSrc"
                                    :src="subBtn.iconSrc"
                                    width="28"
                                    height="28"
                                    alt=""
                                    aria-hidden="true"
                                    class="w-7 h-7 object-contain pointer-events-none"
                                    :class="{ invert: mapStore.drawLayerId === subBtn.id }"
                                />
                                <span
                                    v-else-if="subBtn.text"
                                    aria-hidden="true"
                                    class="text-xl font-bold pointer-events-none leading-none"
                                    :class="
                                        mapStore.drawLayerId === subBtn.id
                                            ? 'text-white'
                                            : 'text-gray-700'
                                    "
                                    >{{ subBtn.text }}</span
                                >
                            </button>
                        </li>
                    </ul>
                </Transition>
            </li>
        </template>
    </ul>
</template>
