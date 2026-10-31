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
import { setMapCursor, removeMapCursor } from './features/featureCursors';
import { buildToolbarButton } from './toolbarButton';
import { buildLegendEntry } from './legendEntry';
import { buildHistoryId } from './features/featureLookup';
import { attachFeatureGroupHover } from './features/featureGroupHover';
import { shouldShowPointFeatures } from '../../features/map/pointFeatureVisibility';
import { isPosition } from '../../features/map/geoJsonCoordinates';
import { openGroupDetails } from '../useGroups';
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
    iconSrc?: string;
    /** Creates and returns the Leaflet marker for a given latlng. Must also add click-to-delete. */
    buildMarker: (latlng: L.LatLng, geoJsonLayer: L.GeoJSON, historyId?: string) => L.Layer;
    /** Returns the icon element used in the legend entry. */
    buildIconEl: () => HTMLElement;
}

export function createPointLayer(config: PointLayerConfig, map: L.Map): IMapLayer {
    const mapStore = useMapStore(pinia);
    const geoJsonLayer = new L.GeoJSON();
    let _selected = false;
    let _visible = false;

    const addMarker = (latlng: L.LatLng, historyId?: string) => {
        const marker = config.buildMarker(latlng, geoJsonLayer, historyId);
        const nextHistoryId = historyId ?? buildHistoryId('point');
        const feature = (marker as any).toGeoJSON?.() as any;

        if (feature) {
            feature.properties = feature.properties ?? {};
            feature.properties.historyId = nextHistoryId;
            (marker as any).feature = feature;
        }

        attachFeatureGroupHover({
            feature: marker,
            getMap: () => useMapStore(pinia).map,
            member: { layerId: config.id, historyId: nextHistoryId },
            getCenter: () => latlng,
            getCursorTarget: (event) => event.originalEvent.target,
            onOpenGroup: openGroupDetails,
            getDescriptionDetails: () => ({ iconSrc: config.iconSrc })
        });

        return { marker, historyId: nextHistoryId };
    };

    const handleMapClick = (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e);
        if (!shouldShowPointFeatures(map)) {
            return;
        }
        const { historyId } = addMarker(e.latlng);
        mapStore.markLayerUpdated({
            kind: 'point-add',
            layerId: config.id,
            payload: {
                lat: e.latlng.lat,
                lng: e.latlng.lng,
                historyId
            }
        });
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
        { flush: 'sync' }
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
        }
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
                iconSrc: config.iconSrc
            });
        },

        getLegendEntry() {
            return buildLegendEntry({
                layerId: config.id,
                title: config.title,
                toggleTitle: config.toggleTitle,
                iconEl: config.buildIconEl(),
                visibilityState: visibilityProxy
            });
        },

        loadFeature(feature: GeoJSON.Feature, historyId?: string): string | null {
            if (feature?.geometry?.type !== 'Point') {
                return null;
            }
            const [lng, lat] = feature.geometry.coordinates;
            return addMarker(new L.LatLng(lat, lng), historyId).historyId;
        },

        loadFromGeoJSON(geoJson: GeoJSON.FeatureCollection): void {
            if (!geoJson?.features) {
                return;
            }
            geoJson.features.forEach((feature) => {
                if (
                    !feature.geometry ||
                    !('coordinates' in feature.geometry) ||
                    !isPosition(feature.geometry.coordinates)
                ) {
                    throw new Error(`Layer "${config.id}" contains a non-point feature.`);
                }
                const [lng, lat] = feature.geometry.coordinates;
                addMarker(new L.LatLng(lat, lng), feature.properties?.historyId);
            });
        },

        getLayer(): L.GeoJSON {
            return geoJsonLayer;
        },
        toGeoJSON(): GeoJSON.FeatureCollection {
            const collection = geoJsonLayer.toGeoJSON();
            if (collection.type !== 'FeatureCollection') {
                throw new Error(`Layer "${config.id}" did not produce a feature collection.`);
            }
            return collection;
        },
        clearLayer(): void {
            geoJsonLayer.clearLayers();
            _visible = false;
        },
        kind: 'point' as const
    };
}
