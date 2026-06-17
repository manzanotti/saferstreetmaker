import * as L from 'leaflet';
import { watch } from 'vue';
import { useMapStore } from '../../stores/mapStore';
import { pinia } from '../../stores/index';
import { setMapCursor, removeMapCursor, buildToolbarButton, buildLegendEntry } from './layerUtils';
import type { IMapLayer } from './IMapLayer';
import { type EditablePolylineLayer } from './usePolylineLayer';

const COLOUR = '#cc00cc';
const BUTTON_ID = 'ltn';
const CURSOR_CSS = 'ltn-cell';

export function createLtnLayer(map: L.Map): EditablePolylineLayer {
  const mapStore = useMapStore(pinia);
  const geoJsonLayer = new L.GeoJSON(undefined, { pane: 'ltns' });
  let _selected = false;
  let _visible = false;
  let _drawingTool: any = null;
  let _ltnTitle = '1';
  let selectionMode: 'draw' | 'edit' = 'draw';

  // ── Add a single LTN polygon ─────────────────────────────────────────────
  const addLtnCell = (points: L.LatLng[], label: string, color: string) => {
    const polygon = new L.Polygon(points, {
      color: color || COLOUR,
      fillOpacity: 0.2,
      weight: 5,
      pane: 'ltns',
      className: 'ltn-cell',
    });

    polygon.on('edit', () => {
      mapStore.markLayerUpdated();
    });

    (polygon as any)['properties'] = { label };

    const tooltip = polygon
      .bindTooltip(label, { permanent: true, direction: 'center' })
      .openTooltip();

    const popup = createLtnPopup(polygon, tooltip, label);

    polygon.on('click', (e: any) => {
      // Disable editing on all other polygons in this layer first.
      geoJsonLayer.eachLayer((l: any) => {
        if (l !== e.target) {
          l.editing?.disable();
        }
      });
      map.closePopup();
      // Switch to this layer for editing (deselects any active point/polyline layer).
      selectForEdit();
      setMapCursor(CURSOR_CSS);
      e.target.editing.enable();
      popup.setLatLng(e.target.getBounds().getCenter());
      map.openPopup(popup);
    });

    geoJsonLayer.addLayer(polygon);
  };

  // ── Popup with label editor + delete button ──────────────────────────────
  const createLtnPopup = (polygon: any, tooltip: any, initialLabel: string): L.Popup => {
    const popup = L.popup({ minWidth: 30, keepInView: true });
    const controlList = document.createElement('ul');
    controlList.classList.add('popup-buttons');

    const labelControl = document.createElement('li');
    const labelEl = document.createElement('input');
    labelEl.type = 'text';
    labelEl.value = initialLabel;
    labelEl.classList.add('label-editor');
    labelEl.addEventListener('keyup', () => {
      const text = labelEl.value;
      tooltip.setTooltipContent(text);
      polygon['properties'].label = text;
      if (text.length === 0) {
        polygon.closeTooltip();
      } else {
        polygon.openTooltip();
      }
      mapStore.markLayerUpdated();
    });
    labelControl.appendChild(labelEl);
    controlList.appendChild(labelControl);

    const deleteControl = document.createElement('li');
    deleteControl.classList.add('delete-button');
    deleteControl.addEventListener('click', () => {
      geoJsonLayer.removeLayer(polygon);
      mapStore.markLayerUpdated();
      map.closePopup(popup);
    });
    controlList.appendChild(deleteControl);

    popup.setContent(controlList);
    return popup;
  };

  // ── draw:created handler ─────────────────────────────────────────────────
  const handleDrawCreated = (e: any) => {
    if (!_selected) {
      return;
    }
    const latLngs = e.layer.getLatLngs()[0]; // polygon outer ring
    addLtnCell(latLngs, _ltnTitle, COLOUR);
    mapStore.markLayerUpdated();
  };

  // ── Zoom-based tooltip visibility ────────────────────────────────────────
  map.on('zoomend', () => {
    const zoom = map.getZoom();
    geoJsonLayer.eachLayer((l: any) => {
      if (zoom < 14) {
        l.closeTooltip?.();
      } else {
        l.openTooltip?.();
      }
    });
  });

  // ── Sync watch for selection state ───────────────────────────────────────
  watch(
    () => mapStore.activeLayerId,
    (newId) => {
      const shouldBeSelected = newId === BUTTON_ID;
      if (shouldBeSelected && !_selected) {
        _selected = true;
        setMapCursor(CURSOR_CSS);
        if (selectionMode === 'draw') {
          _drawingTool = new L.Draw.Polygon(map, { color: COLOUR });
          _drawingTool.enable();
          map.on('draw:created', handleDrawCreated);
        }
      } else if (!shouldBeSelected && _selected) {
        _selected = false;
        _drawingTool?.disable();
        _drawingTool = null;
        geoJsonLayer.eachLayer((l: any) => l.editing?.disable());
        removeMapCursor(CURSOR_CSS);
        map.off('draw:created', handleDrawCreated);
        selectionMode = 'draw';
      }
    },
    { flush: 'sync' },
  );

  const action = (_e: Event, _m: L.Map): void => {
    selectionMode = 'draw';
  };

  /** Switch to this layer for editing an existing polygon without enabling draw mode. */
  const selectForEdit = (): void => {
    selectionMode = 'edit';
    mapStore.setActiveLayer(BUTTON_ID);
  };

  const visibilityProxy = {
    get visible() {
      return _visible;
    },
    set visible(v: boolean) {
      _visible = v;
    },
  };

  return {
    id: 'LtnCells',
    title: 'LTN Cells',
    groupName: '',
    get selected() {
      return _selected;
    },
    set selected(v: boolean) {
      _selected = v;
    },
    get visible() {
      return _visible;
    },
    set visible(v: boolean) {
      _visible = v;
    },
    iconHtml: (() => {
      const i = document.createElement('i');
      i.style.backgroundColor = COLOUR;
      return i.outerHTML;
    })(),

    getToolbarButton() {
      return buildToolbarButton({
        id: BUTTON_ID,
        tooltip: 'Add LTNs to the map',
        groupName: '',
        action,
        selected: _selected,
        text: 'LTN',
      });
    },

    getLegendEntry() {
      const icon = document.createElement('i');
      icon.style.backgroundColor = COLOUR;
      return buildLegendEntry({
        layerId: 'LtnCells',
        title: 'LTN Cells',
        toggleTitle: 'Toggle LTNs from the map',
        iconEl: icon,
        visibilityState: visibilityProxy,
      });
    },

    loadFromGeoJSON(geoJson: any): void {
      if (!geoJson?.features) {
        return;
      }
      geoJson.features.forEach((feature: any) => {
        const points: L.LatLng[] = [];
        const polygonCoords = feature.geometry.coordinates[0];
        polygonCoords.forEach((c: number[]) => points.push(new L.LatLng(c[1], c[0])));
        const { label, color } = feature.properties ?? {};
        addLtnCell(points, label ?? '1', color ?? COLOUR);
      });
    },

    getLayer(): L.GeoJSON {
      return geoJsonLayer;
    },

    toGeoJSON(): object {
      const json: any = { type: 'FeatureCollection', features: [] };
      geoJsonLayer.eachLayer((l: any) => {
        const feature = (l as L.Polygon).toGeoJSON() as any;
        feature.properties.label = l['properties']?.label ?? '';
        feature.properties.color = l.options?.color ?? COLOUR;
        json.features.push(feature);
      });
      return json;
    },

    clearLayer(): void {
      geoJsonLayer.clearLayers();
      _visible = false;
    },

    selectForEdit,
  };
}
