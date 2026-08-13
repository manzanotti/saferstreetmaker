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
import {
    setMapCursor,
    removeMapCursor,
    buildToolbarButton,
    buildLegendEntry,
    buildHistoryId,
    getFeatureHistoryId,
    buildFeatureActionPopup,
    buildFeatureDescriptionPopup,
    addFeatureHoverPopup,
    getFeatureHoverLatLng,
    closeFeatureHoverPopups,
    createFeatureHoverPopupController
} from './layerUtils';
import { useSelectionStore } from '../../stores/selectionStore';
import { executeAreaDelete, executeCopy, selectFeature } from '../useAreaSelection';
import { useSettingsStore } from '../../stores/settingsStore';
import {
    addFeatureToGroup,
    createGroupFromFeature,
    openGroupDetails,
    removeFeatureFromGroup
} from '../useGroups';
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

export function getPointEventLatLng(event: {
    target?: { getLatLng?: () => L.LatLng };
    latlng?: L.LatLng;
}) {
    return event.target?.getLatLng?.() ?? event.latlng ?? null;
}

/**
 * Shared click handler for point-marker features. While an area selection is
 * active (including the "add to group" flow), clicking a point adds it to the
 * current selection instead of deleting it — so points can be gathered the
 * same way polylines/polygons are. Otherwise it opens the feature popup.
 */
export function handlePointFeatureClick(
    event: L.LeafletMouseEvent,
    layerId: string,
    iconSrc?: string
): void {
    L.DomEvent.stopPropagation(event);

    const selectionStore = useSelectionStore(pinia);
    const isModifierClick =
        event.originalEvent?.shiftKey ||
        event.originalEvent?.ctrlKey ||
        event.originalEvent?.metaKey;
    if (selectionStore.isActive || selectionStore.isPhaseEditing || isModifierClick) {
        // Modifier-click toggles this point in the selection. A normal click
        // while selection mode is active adds it to the selection.
        selectFeature(event.target as unknown as L.Layer, layerId, true, false, isModifierClick);
        return;
    }

    const mapStore = useMapStore(pinia);
    const latLng = getPointEventLatLng(event);
    const historyId = getFeatureHistoryId(event.target);
    const map = mapStore.map;
    if (!map || !historyId) {
        return;
    }

    const member = { layerId, historyId };
    closeFeatureHoverPopups(map);
    if (useSettingsStore(pinia).readOnly) {
        const descriptionPopup = buildFeatureDescriptionPopup(
            { minWidth: 30, keepInView: true },
            member,
            'click',
            { iconSrc }
        );
        descriptionPopup?.setLatLng(latLng ?? map.getCenter()).openOn(map);
        return;
    }

    const popup = buildFeatureActionPopup({
        map,
        popupOptions: { minWidth: 30, keepInView: true },
        member,
        onDelete: () => {
            selectFeature(event.target as unknown as L.Layer, layerId, false);
            executeAreaDelete();
        },
        onCopy: () => {
            selectFeature(event.target as unknown as L.Layer, layerId, false);
            executeCopy();
        },
        onOpenGroup: openGroupDetails,
        onRemoveFromGroup: (groupId) => removeFeatureFromGroup(groupId, member),
        onAddToGroup: (groupId) => addFeatureToGroup(groupId, member),
        onCreateNewGroup: createGroupFromFeature
    });
    popup.setLatLng(latLng ?? map.getCenter()).openOn(map);
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

        const hoverPopupController = createFeatureHoverPopupController();

        marker.on('mouseover', (event: L.LeafletMouseEvent) => {
            const markerMap = useMapStore(pinia).map;
            if (!markerMap) {
                return;
            }

            closeFeatureHoverPopups(markerMap);

            const descriptionPopup = buildFeatureDescriptionPopup(
                { minWidth: 30, keepInView: true },
                { layerId: config.id, historyId: nextHistoryId },
                'hover',
                { iconSrc: config.iconSrc }
            );
            if (descriptionPopup) {
                hoverPopupController.set(descriptionPopup);
                addFeatureHoverPopup(
                    markerMap,
                    descriptionPopup,
                    getFeatureHoverLatLng(markerMap, latlng, event.latlng),
                    () => hoverPopupController.close(descriptionPopup)
                );
            }
        });
        marker.on('mouseout', () => {
            hoverPopupController.scheduleClose();
        });

        return { marker, historyId: nextHistoryId };
    };

    const handleMapClick = (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e);
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

        loadFeature(feature: any, historyId?: string): string | null {
            if (feature?.geometry?.type !== 'Point') {
                return null;
            }
            const [lng, lat] = feature.geometry.coordinates;
            return addMarker(new L.LatLng(lat, lng), historyId).historyId;
        },

        loadFromGeoJSON(geoJson: any): void {
            if (!geoJson?.features) {
                return;
            }
            geoJson.features.forEach((feature: any) => {
                const [lng, lat] = feature.geometry.coordinates;
                addMarker(new L.LatLng(lat, lng), feature.properties?.historyId);
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
        kind: 'point' as const
    };
}
