/**
 * Shared helper for polyline layers that need a rich addPolyline() implementation:
 * edit-on-click, popup with delete button, optional re-init of drawing tool.
 *
 * Note on DOM usage: popup content is built with `document.createElement` because
 * Leaflet controls the popup DOM lifecycle and it lives outside Vue's virtual DOM.
 */
import * as L from 'leaflet';
import { buildDeletePopup } from './layerUtils';
import { setMapCursor } from './layerUtils';
import { useMapStore } from '../../stores/mapStore';
import { pinia } from '../../stores/index';

export interface PolylineOptions {
    color: string;
    weight: number;
    opacity: number;
    smoothFactor: number;
}

export interface AddPolylineOpts {
    points: L.LatLng[];
    geoJsonLayer: L.GeoJSON;
    map: L.Map;
    polylineOpts: PolylineOptions;
    buttonId: string;
    /**
     * Switch the owning layer into "edit existing feature" mode.
     * This must deselect any previously-active point layer without enabling
     * leaflet.draw create mode for the polyline layer.
     */
    selectForEdit: () => void;
    /** If true, re-create and enable the drawing tool after draw:created. */
    reinitDrawing?: (map: L.Map) => void;
    popupKeepInView?: boolean;
    /** Extra config for arrowheads plugin */
    arrowheads?: object;
}

export function addPolylineToLayer(opts: AddPolylineOpts): void {
    const mapStore = useMapStore(pinia);
    const { points, geoJsonLayer, map, polylineOpts, buttonId } = opts;

    let polyline = new L.Polyline(points, polylineOpts) as any;

    if (opts.arrowheads) {
        polyline = polyline.arrowheads(opts.arrowheads);
    }

    polyline.on('edit', () => {
        mapStore.markLayerUpdated();
    });

    const popup = buildDeletePopup(
        map,
        { minWidth: 30, keepInView: opts.popupKeepInView ?? true },
        () => {
            geoJsonLayer.removeLayer(polyline);
            mapStore.markLayerUpdated();
        }
    );

    polyline.on('click', (e: any) => {
        opts.selectForEdit();
        setMapCursor(buttonId);
        e.target.editing.enable();
        popup.setLatLng(e.latlng);
        map.openPopup(popup);
    });

    geoJsonLayer.addLayer(polyline);

    if (opts.reinitDrawing) {
        opts.reinitDrawing(map);
    }
}

/**
 * Load a polyline FeatureCollection into a GeoJSON layer.
 * Handles the legacy "nested coordinates" format.
 */
export function loadPolylineGeoJSON(geoJson: any, addFn: (points: L.LatLng[]) => void): void {
    if (!geoJson?.features) {
        return;
    }
    geoJson.features.forEach((feature: any) => {
        const points: L.LatLng[] = [];
        const raw = feature.geometry.coordinates;
        // Legacy: coordinates wrapped in an extra array
        const coords = raw.length === 1 ? raw[0] : raw;
        coords.forEach((c: number[]) => points.push(new L.LatLng(c[1], c[0])));
        addFn(points);
    });
}
