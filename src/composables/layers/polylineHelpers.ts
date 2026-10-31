/**
 * Shared helper for polyline layers that need a rich addPolyline() implementation:
 * edit-on-click and popup with delete button.
 *
 * Note on DOM usage: popup content is built with `document.createElement` because
 * Leaflet controls the popup DOM lifecycle and it lives outside Vue's virtual DOM.
 */
import * as L from 'leaflet';
import { buildHistoryId } from './features/featureLookup';
import { attachPolylineInteractions } from './features/polylineFeatureInteractions';
import {
    buildPolylinePointChanges,
    getFeatureCoordinates
} from './features/polylineHistoryGeometry';
import { useMapStore } from '../../stores/mapStore';
import { pinia } from '../../stores/index';

export interface PolylineOptions {
    color: string;
    weight: number;
    opacity: number;
    smoothFactor: number;
    className?: string;
}

export interface AddPolylineOpts {
    points: L.LatLng[];
    geoJsonLayer: L.GeoJSON;
    map: L.Map;
    layerId: string;
    polylineOpts: PolylineOptions;
    buttonId: string;
    /**
     * Switch the owning layer into "edit existing feature" mode.
     * This must deselect any previously-active point layer without enabling
     * leaflet.draw create mode for the polyline layer.
     */
    selectForEdit: () => void;
    popupKeepInView?: boolean;
    /** Extra config for arrowheads plugin */
    arrowheads?: object;
    historyId?: string;
    name?: string;
    iconSrc?: string;
}

export function addPolylineToLayer(opts: AddPolylineOpts): L.Popup {
    const mapStore = useMapStore(pinia);
    const { points, geoJsonLayer, map, layerId, polylineOpts, buttonId } = opts;
    const mutationKind = buttonId === 'ltn-cell' ? 'polygon' : 'polyline';

    let polyline = new L.Polyline(points, polylineOpts) as any;

    if (opts.arrowheads) {
        polyline = polyline.arrowheads(opts.arrowheads);
    }

    const historyId = opts.historyId ?? buildHistoryId('polyline');
    let name = opts.name ?? '';

    const buildPolylineHistoryFeature = () => {
        const feature = polyline.toGeoJSON() as any;
        feature.properties = {
            ...(feature.properties ?? {}),
            historyId,
            name
        };
        return feature;
    };

    polyline.feature = buildPolylineHistoryFeature();
    let lastCommittedFeature = buildPolylineHistoryFeature();

    const renamePolyline = (nextName: string) => {
        if (nextName === name) {
            return;
        }

        const before = lastCommittedFeature;
        name = nextName;
        const after = buildPolylineHistoryFeature();
        polyline.feature = after;
        lastCommittedFeature = after;
        mapStore.markLayerUpdated({
            kind: `${mutationKind}-edit`,
            layerId,
            payload: { before, after }
        });
    };

    polyline.on('edit', () => {
        const nextFeature = buildPolylineHistoryFeature();
        const beforeCoordinates = getFeatureCoordinates(lastCommittedFeature);
        const afterCoordinates = getFeatureCoordinates(nextFeature);
        const pointChanges = buildPolylinePointChanges(beforeCoordinates, afterCoordinates);
        mapStore.markLayerUpdated({
            kind: `${mutationKind}-edit`,
            layerId,
            payload: pointChanges
                ? {
                      historyId,
                      pointChanges
                  }
                : {
                      historyId,
                      beforeCoordinates,
                      afterCoordinates
                  }
        });
        polyline.feature = nextFeature;
        lastCommittedFeature = nextFeature;
    });

    const popup = attachPolylineInteractions({
        polyline,
        geoJsonLayer,
        map,
        layerId,
        buttonId,
        historyId,
        selectForEdit: opts.selectForEdit,
        getName: () => name,
        rename: renamePolyline,
        popupKeepInView: opts.popupKeepInView,
        iconSrc: opts.iconSrc
    });

    geoJsonLayer.addLayer(polyline);
    popup.setLatLng(polyline.getBounds().getCenter());
    return popup;
}
