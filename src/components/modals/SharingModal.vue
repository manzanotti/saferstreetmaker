<script setup lang="ts">
import { ref } from 'vue';
import * as L from 'leaflet';
import LZString from 'lz-string';
import { useSettingsStore } from '../../stores/settingsStore';
import { useMapStore } from '../../stores/mapStore';
import { useUiStore } from '../../stores/uiStore';
import { getFileManager } from '../../composables/useMapManager';
import { Settings } from '../../scripts/Settings';

const settingsStore = useSettingsStore();
const mapStore = useMapStore();
const uiStore = useUiStore();

const width = ref<number | null>(null);
const height = ref<number | null>(null);
const hideToolbar = ref(false);
const showCopiedMessage = ref(false);

function buildSettingsSnapshot(): Settings {
  const s = new Settings();
  s.title = settingsStore.title;
  s.readOnly = settingsStore.readOnly;
  s.hideToolbar = settingsStore.hideToolbar;
  s.activeLayers = [...settingsStore.activeLayers];
  s.zoom = settingsStore.zoom;
  s.centre = settingsStore.centre ?? new L.LatLng(0, 0);
  s.version = settingsStore.version;
  return s;
}

function buildLayersMap() {
  const map = new Map();
  mapStore.layers.forEach((l) => map.set(l.id, l));
  return map;
}

function onCreate() {
  if (!width.value || !height.value) return;

  const mapHash = getFileManager().saveMapToHash(buildSettingsSnapshot(), buildLayersMap());
  const origin = window.location.origin;
  const html = `<iframe src="${origin}?hide-toolbar=${hideToolbar.value}#${mapHash}" width="${width.value}" height="${height.value}" title="title"></iframe>`;

  showCopiedMessage.value = true;

  if (!navigator.clipboard) return;

  navigator.clipboard.writeText(html).catch((err) => {
    console.warn('Clipboard write failed:', err);
  });
}

function onClose() {
  uiStore.closeModal();
}
</script>

<template>
  <form id="sharing" class="popup modal" @submit.prevent="onCreate">
    <h4>Share map</h4>

    <div class="mb-2">
      <label for="width">Width</label>
      <input id="width" v-model.number="width" type="number" required class="border-solid" />
      <span>px</span>
    </div>

    <div class="mb-2">
      <label for="height">Height</label>
      <input id="height" v-model.number="height" type="number" required class="border-solid" />
      <span>px</span>
    </div>

    <div class="toggle flex justify-left mb-2">
      <div class="form-check form-switch flex items-center gap-2">
        <input id="hide-toolbar" v-model="hideToolbar" type="checkbox" role="switch" />
        <label class="form-check-label inline-block text-gray-800" for="hide-toolbar"
          >Hide toolbar</label
        >
      </div>
    </div>

    <div id="messageRow" :style="{ display: showCopiedMessage ? 'block' : 'none' }">
      Copied to clipboard
    </div>

    <div class="flex justify-center mb-2">
      <button
        type="submit"
        class="inline-block px-6 py-2.5 bg-blue-600 text-white font-medium text-xs leading-tight uppercase rounded-sm shadow-md hover:bg-blue-700"
      >
        Create
      </button>
      <button
        type="button"
        class="inline-block px-6 py-2.5 bg-blue-600 text-white font-medium text-xs leading-tight uppercase rounded-sm shadow-md hover:bg-blue-700"
        @click="onClose"
      >
        Close
      </button>
    </div>
  </form>
</template>
