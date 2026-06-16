import { defineStore } from 'pinia';
import { ref } from 'vue';
import type * as L from 'leaflet';

export const useSettingsStore = defineStore('settings', () => {
  const title = ref('Hello Cleveland');
  const readOnly = ref(false);
  const hideToolbar = ref(false);
  const activeLayers = ref<string[]>([]);
  const centre = ref<L.LatLng | null>(null);
  const zoom = ref(0);
  const version = ref('');

  function applyFromSettings(s: {
    title: string;
    readOnly: boolean;
    hideToolbar: boolean;
    activeLayers: string[];
    centre: L.LatLng | null;
    zoom: number;
    version: string;
  }) {
    title.value = s.title;
    readOnly.value = s.readOnly;
    hideToolbar.value = s.hideToolbar;
    activeLayers.value = s.activeLayers;
    centre.value = s.centre;
    zoom.value = s.zoom;
    version.value = s.version;
  }

  return {
    title,
    readOnly,
    hideToolbar,
    activeLayers,
    centre,
    zoom,
    version,
    applyFromSettings,
  };
});
