/**
 * usePolylineLayer.ts
 *
 * Shared factory for all polyline/polygon layers.
 * Replaces PubSub subscriptions with a sync watch on mapStore.activeLayerId
 * and a direct map.on('draw:created') listener.
 */
import * as L from 'leaflet';
import { watch } from 'vue';
import { useMapStore } from '../../stores/mapStore';
import { pinia } from '../../stores/index';
import { setMapCursor, removeMapCursor, buildToolbarButton, buildLegendEntry } from './layerUtils';
import type { IMapLayer } from './IMapLayer';

export interface PolylineLayerConfig {
    id: string;
    title: string;
    groupName: string;
    buttonId: string;
    tooltip: string;
    toggleTitle: string;
    /**
     * Create (and enable) a new Leaflet.draw tool.
     * Called when the layer is selected.
     */
    createDrawingTool: (map: L.Map) => { disable(): void };
    /**
     * Called after draw:created fires.
     * Must add the new feature to geoJsonLayer and return it.
     */
    onDrawCreated: (latLngs: L.LatLng[], geoJsonLayer: L.GeoJSON, map: L.Map) => void;
    buildIconEl: () => HTMLElement;
}

export interface EditablePolylineLayer extends IMapLayer {
    /**
     * Select this layer for editing an existing feature without enabling
     * leaflet.draw create mode.
     */
    selectForEdit: () => void;
}

export function createPolylineLayer(
    config: PolylineLayerConfig,
    map: L.Map,
): EditablePolylineLayer {
    const mapStore = useMapStore(pinia);
    const geoJsonLayer = new L.GeoJSON();
    let _selected = false;
    let _visible = false;
    let _drawingTool: { disable(): void } | null = null;
    let selectionMode: 'draw' | 'edit' = 'draw';

    const handleDrawCreated = (e: any) => {
        if (!_selected) {
            return;
        }
        config.onDrawCreated(e.layer.getLatLngs(), geoJsonLayer, map);
        mapStore.markLayerUpdated();
    };

    watch(
        () => mapStore.activeLayerId,
        (newId) => {
            const shouldBeSelected = newId === config.buttonId;
            if (shouldBeSelected && !_selected) {
                _selected = true;
                setMapCursor(config.buttonId);
                if (selectionMode === 'draw') {
                    _drawingTool = config.createDrawingTool(map);
                    map.on('draw:created', handleDrawCreated);
                }
            } else if (!shouldBeSelected && _selected) {
                _selected = false;
                _drawingTool?.disable();
                _drawingTool = null;
                geoJsonLayer.eachLayer((l: any) => l.editing?.disable());
                removeMapCursor(config.buttonId);
                map.off('draw:created', handleDrawCreated);
                selectionMode = 'draw';
            }
        },
        { flush: 'sync' },
    );

    const action = (_event: Event, _map: L.Map): void => {
        selectionMode = 'draw';
    };

    const selectForEdit = (): void => {
        selectionMode = 'edit';
        mapStore.setActiveLayer(config.buttonId);
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
        id: config.id,
        title: config.title,
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
        groupName: config.groupName,
        iconHtml: config.buildIconEl().outerHTML,

        getToolbarButton() {
            return buildToolbarButton({
                id: config.buttonId,
                tooltip: config.tooltip,
                groupName: config.groupName,
                action,
                selected: _selected,
            });
        },

        getLegendEntry() {
            return buildLegendEntry({
                layerId: config.id,
                title: config.title,
                toggleTitle: config.toggleTitle,
                iconEl: config.buildIconEl(),
                visibilityState: visibilityProxy,
            });
        },

        loadFromGeoJSON(_geoJson: any): void {
            /* implemented per-layer — override by reassigning after creation */
        },

        getLayer(): L.GeoJSON {
            return geoJsonLayer;
        },
        toGeoJSON(): object {
            return geoJsonLayer.toGeoJSON();
        },
        clearLayer(): void {
            geoJsonLayer.clearLayers();
            _visible = false;
        },

        selectForEdit,
    };
}
