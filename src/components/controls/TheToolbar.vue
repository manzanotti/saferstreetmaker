<script setup lang="ts">
import { computed, ref } from 'vue';
import { useMapStore } from '../../stores/mapStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useUiStore, type ModalId } from '../../stores/uiStore';
import type { ToolbarButton } from '../../scripts/Controls/ToolbarButton';

const mapStore = useMapStore();
const settingsStore = useSettingsStore();
const uiStore = useUiStore();

// ── Modal button definitions ───────────────────────────────────────────────
interface ModalButtonDef {
  id: string;
  modalId: ModalId;
  tooltip: string;
}

const modalButtons: ModalButtonDef[] = [
  { id: 'map-manager', modalId: 'mapManager', tooltip: 'Save, load, and export maps' },
  { id: 'settings', modalId: 'settings', tooltip: 'Change map settings' },
  { id: 'share', modalId: 'sharing', tooltip: 'Share this map' },
  { id: 'help', modalId: 'help', tooltip: 'Instructions on how to use the map' },
];

// ── Layer button groups ────────────────────────────────────────────────────
interface GroupItem {
  type: 'group';
  /** Button currently shown as the top-level item (selected or anchor). */
  parent: ToolbarButton;
  /** Buttons shown in the submenu. */
  sub: ToolbarButton[];
  /** Position of this group, used to keep position stable on selection change. */
  groupName: string;
}

interface SingleItem {
  type: 'single';
  button: ToolbarButton;
}

type ToolbarItem = GroupItem | SingleItem;

/** Build the ordered list of toolbar items from active layers. */
const layerItems = computed<ToolbarItem[]>(() => {
  if (settingsStore.readOnly) return [];

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

    if (handledGroups.has(btn.groupName)) continue;
    handledGroups.add(btn.groupName);

    const groupBtns = allButtons.filter((b) => b.groupName === btn.groupName);
    const anchor = groupBtns.find((b) => b.isFirst) ?? groupBtns[0];

    // The currently active layer (if any) in this group becomes the parent
    // so it's always visible. Falls back to the anchor when nothing is active.
    const active = groupBtns.find((b) => b.id === mapStore.activeLayerId) ?? anchor;
    const sub = groupBtns.filter((b) => b.id !== active.id);

    items.push({ type: 'group', parent: active, sub, groupName: btn.groupName });
  }

  return items;
});

// ── Submenu visibility (per-group) ─────────────────────────────────────────
const openSubmenus = ref<Record<string, boolean>>({});

function showSubmenu(groupName: string) {
  openSubmenus.value = { ...openSubmenus.value, [groupName]: true };
}

function hideSubmenu(groupName: string) {
  openSubmenus.value = { ...openSubmenus.value, [groupName]: false };
}

// ── Button click handlers ──────────────────────────────────────────────────
function onLayerButtonClick(btn: ToolbarButton) {
  const map = mapStore.map;
  if (!map) return;

  // Update Vue store immediately for the toolbar's visual selected state.
  // The layer engine's state (state.selected, drawing tool init) is driven
  // by btn.action() below which runs synchronously.
  const newId = mapStore.activeLayerId === btn.id ? null : btn.id;
  mapStore.setActiveLayer(newId);

  // Call the layer's own action directly — this is synchronous and:
  //  • sets layer.selected (needed before any map click)
  //  • initialises the leaflet-draw tool for polyline/polygon layers
  //  • publishes PubSub.layerSelected / layerDeselected for cross-layer deselection
  btn.action(new Event('click'), map);
}

function onModalButtonClick(modalId: ModalId) {
  if (uiStore.activeModal === modalId) {
    uiStore.closeModal();
  } else {
    uiStore.openModal(modalId);
  }
}

function onGroupButtonClick(item: GroupItem) {
  // Right-click is handled by contextmenu; primary click activates the layer.
  onLayerButtonClick(item.parent);
  // Hide submenu after selecting from it.
  hideSubmenu(item.groupName);
}

function onSubButtonClick(groupName: string, btn: ToolbarButton) {
  onLayerButtonClick(btn);
  hideSubmenu(groupName);
}

// Long-press support for mobile (mirrors Toolbar.ts behaviour)
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
</script>

<template>
  <ul class="toolbar">
    <!-- Layer buttons (single + grouped) -->
    <template
      v-for="item in layerItems"
      :key="item.type === 'group' ? item.groupName : item.button.id"
    >
      <!-- Single layer button -->
      <li v-if="item.type === 'single'">
        <input
          :id="`${item.button.id}-button`"
          type="button"
          :class="[
            'toolbar-button',
            item.button.id,
            { selected: mapStore.activeLayerId === item.button.id },
          ]"
          :title="item.button.tooltip"
          :value="item.button.text || undefined"
          @click.stop="onLayerButtonClick(item.button)"
        />
      </li>

      <!-- Grouped layer button with submenu -->
      <li
        v-else-if="item.type === 'group'"
        class="group"
        @contextmenu.prevent="showSubmenu(item.groupName)"
        @touchstart="onTouchStart(item.groupName)"
        @touchend="cancelLongPress(item.groupName)"
        @touchmove="cancelLongPress(item.groupName)"
      >
        <!-- Parent button (selected member OR anchor) -->
        <input
          :id="`${item.parent.id}-button`"
          type="button"
          :class="[
            'toolbar-button',
            item.parent.id,
            { selected: mapStore.activeLayerId === item.parent.id },
          ]"
          :title="item.parent.tooltip"
          :value="item.parent.text || undefined"
          @click.stop="onLayerButtonClick(item.parent)"
        />

        <!-- Submenu -->
        <ul class="subToolbar" :class="{ hidden: !openSubmenus[item.groupName] }">
          <li v-for="subBtn in item.sub" :key="subBtn.id">
            <input
              :id="`${subBtn.id}-button`"
              type="button"
              :class="[
                'toolbar-button',
                subBtn.id,
                { selected: mapStore.activeLayerId === subBtn.id },
              ]"
              :title="subBtn.tooltip"
              :value="subBtn.text || undefined"
              @click.stop="onLayerButtonClick(subBtn)"
            />
          </li>
        </ul>

        <!-- Corner indicator for grouped buttons -->
        <span></span>
      </li>
    </template>

    <!-- Modal buttons (settings, map manager, sharing, help) -->
    <li v-for="mb in modalButtons" :key="mb.id">
      <input
        :id="`${mb.id}-button`"
        type="button"
        :class="['toolbar-button', mb.id, { selected: uiStore.activeModal === mb.modalId }]"
        :title="mb.tooltip"
        @click.stop="onModalButtonClick(mb.modalId)"
      />
    </li>
  </ul>
</template>
