/**
 * usePointLayer.ts
 *
 * Shared factory for all 5 point-marker layers.
 * Replaces PubSub subscriptions with a sync watch on mapStore.activeLayerId.
 */
import * as L from 'leaflet';
import { watch } from 'vue';
import { useMapStore } from '../../stores/mapStore';
import { pinia } from '../../stores/index';
import { setMapCursor, removeMapCursor, buildToolbarButton, buildLegendEntry } from './layerUtils';
import type { IMapLayer } from './IMapLayer';

export interface PointLayerConfig {
    /** Layer data id (e.g. 'ModalFilters'). */
    id: string;
    title: string;
    groupName: string;
    /** Button / cursor CSS id (e.g. 'modal-filter'). */
    buttonId: string;
    tooltip: string;
    toggleTitle: string;
    isFirst?: boolean;
    text?: string;
    /** Creates and returns the Leaflet marker for a given latlng. Must also add click-to-delete. */
    buildMarker: (latlng: L.LatLng, geoJsonLayer: L.GeoJSON) => L.Layer;
    /** Returns the icon element used in the legend entry. */
    buildIconEl: () => HTMLElement;
}

export function createPointLayer(config: PointLayerConfig, map: L.Map): IMapLayer {
    const mapStore = useMapStore(pinia);
    const geoJsonLayer = new L.GeoJSON();
    let _selected = false;
    let _visible = false;

    const addMarker = (latlng: L.LatLng) => {
        config.buildMarker(latlng, geoJsonLayer);
    };

    const handleMapClick = (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e);
        addMarker(e.latlng);
        mapStore.markLayerUpdated();
    };

    // Sync watch: fires immediately (flush: 'sync') when activeLayerId changes,
    // so Leaflet event listeners attach/detach in the same tick as selection changes.
    watch(
        () => mapStore.activeLayerId,
        (newId) => {
            const shouldBeSelected = newId === config.buttonId;
            if (shouldBeSelected && !_selected) {
                _selected = true;
                setMapCursor(config.buttonId);
                map.on('click', handleMapClick as L.LeafletEventHandlerFn);
            } else if (!shouldBeSelected && _selected) {
                _selected = false;
                removeMapCursor(config.buttonId);
                map.off('click', handleMapClick as L.LeafletEventHandlerFn);
            }
        },
        { flush: 'sync' },
    );

    // No-op action: selection is handled by the sync watch above.
    const action = (_event: Event, _map: L.Map): void => {};

    // Proxy for the visibilityState passed to buildLegendEntry.
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
                isFirst: config.isFirst,
                text: config.text,
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

        loadFromGeoJSON(geoJson: any): void {
            if (!geoJson?.features) {
                return;
            }
            geoJson.features.forEach((feature: any) => {
                const [lng, lat] = feature.geometry.coordinates;
                addMarker(new L.LatLng(lat, lng));
            });
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
    };
}
