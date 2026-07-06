/**
 * Shared helper for polyline layers that need a rich addPolyline() implementation:
 * edit-on-click, popup with delete button, optional re-init of drawing tool.
 *
 * Note on DOM usage: popup content is built with `document.createElement` because
 * Leaflet controls the popup DOM lifecycle and it lives outside Vue's virtual DOM.
 */
import * as L from 'leaflet';
import {
    buildDeletePopup,
    removeMapCursor,
    setMouseMarkerCursor,
    buildHistoryId
} from './layerUtils';
import { useMapStore } from '../../stores/mapStore';
import { pinia } from '../../stores/index';
import { selectFeature, executeCopy } from '../useAreaSelection';
import { useSelectionStore } from '../../stores/selectionStore';

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
    /** If true, re-create and enable the drawing tool after draw:created. */
    reinitDrawing?: (map: L.Map) => void;
    popupKeepInView?: boolean;
    /** Extra config for arrowheads plugin */
    arrowheads?: object;
    historyId?: string;
}

function getFeatureCoordinates(feature: any): number[][] {
    const coordinates = feature?.geometry?.coordinates;
    return Array.isArray(coordinates)
        ? coordinates.map((coordinate: any) => [coordinate[0], coordinate[1]])
        : [];
}

type PolylinePointChange =
    | {
          type: 'update';
          index: number;
          before: number[];
          after: number[];
      }
    | {
          type: 'insert';
          index: number;
          after: number[];
      }
    | {
          type: 'delete';
          index: number;
          before: number[];
      };

function buildPolylinePointChanges(beforeCoords: number[][], afterCoords: number[][]) {
    let prefix = 0;
    while (
        prefix < beforeCoords.length &&
        prefix < afterCoords.length &&
        beforeCoords[prefix][0] === afterCoords[prefix][0] &&
        beforeCoords[prefix][1] === afterCoords[prefix][1]
    ) {
        prefix++;
    }

    let suffix = 0;
    while (
        suffix < beforeCoords.length - prefix &&
        suffix < afterCoords.length - prefix &&
        beforeCoords[beforeCoords.length - 1 - suffix][0] ===
            afterCoords[afterCoords.length - 1 - suffix][0] &&
        beforeCoords[beforeCoords.length - 1 - suffix][1] ===
            afterCoords[afterCoords.length - 1 - suffix][1]
    ) {
        suffix++;
    }

    const beforeMiddle = beforeCoords.slice(prefix, beforeCoords.length - suffix);
    const afterMiddle = afterCoords.slice(prefix, afterCoords.length - suffix);
    const pointChanges: PolylinePointChange[] = [];

    const sharedLength = Math.min(beforeMiddle.length, afterMiddle.length);
    for (let index = 0; index < sharedLength; index++) {
        const beforePoint = beforeMiddle[index];
        const afterPoint = afterMiddle[index];
        if (!Array.isArray(afterPoint) || beforePoint.length !== 2 || afterPoint.length !== 2) {
            return null;
        }

        if (beforePoint[0] === afterPoint[0] && beforePoint[1] === afterPoint[1]) {
            continue;
        }

        pointChanges.push({
            type: 'update',
            index: prefix + index,
            before: [beforePoint[0], beforePoint[1]],
            after: [afterPoint[0], afterPoint[1]]
        });
    }

    if (beforeMiddle.length > afterMiddle.length) {
        for (let index = sharedLength; index < beforeMiddle.length; index++) {
            const beforePoint = beforeMiddle[index];
            if (beforePoint.length !== 2) {
                return null;
            }

            pointChanges.push({
                type: 'delete',
                index: prefix + sharedLength,
                before: [beforePoint[0], beforePoint[1]]
            });
        }
    } else if (afterMiddle.length > beforeMiddle.length) {
        for (let index = sharedLength; index < afterMiddle.length; index++) {
            const afterPoint = afterMiddle[index];
            if (!Array.isArray(afterPoint) || afterPoint.length !== 2) {
                return null;
            }

            pointChanges.push({
                type: 'insert',
                index: prefix + index,
                after: [afterPoint[0], afterPoint[1]]
            });
        }
    }

    return pointChanges.length > 0 ? pointChanges : null;
}

export function addPolylineToLayer(opts: AddPolylineOpts): void {
    const mapStore = useMapStore(pinia);
    const { points, geoJsonLayer, map, layerId, polylineOpts, buttonId } = opts;
    const mutationKind = buttonId === 'ltn-cell' ? 'polygon' : 'polyline';

    let polyline = new L.Polyline(points, polylineOpts) as any;

    if (opts.arrowheads) {
        polyline = polyline.arrowheads(opts.arrowheads);
    }

    const historyId = opts.historyId ?? buildHistoryId('polyline');

    const buildPolylineHistoryFeature = () => {
        const feature = polyline.toGeoJSON() as any;
        feature.properties = feature.properties ?? {};
        feature.properties.historyId = historyId;
        return feature;
    };

    polyline.feature = buildPolylineHistoryFeature();
    let lastCommittedFeature = buildPolylineHistoryFeature();

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

    polyline.on('mouseover', () => {
        if (mapStore.activeLayerId === buttonId) {
            setMouseMarkerCursor('pointer');
        }
    });

    polyline.on('mouseout', () => {
        if (mapStore.activeLayerId === buttonId) {
            setMouseMarkerCursor(null);
        }
    });

    const popup = buildDeletePopup(
        map,
        { minWidth: 30, keepInView: opts.popupKeepInView ?? true },
        () => {
            geoJsonLayer.removeLayer(polyline);
            mapStore.markLayerUpdated({
                kind: `${mutationKind}-delete`,
                layerId,
                payload: {
                    before: lastCommittedFeature
                }
            });
        },
        () => {
            // Populate the selection with this entire feature, then copy it.
            selectFeature(polyline as unknown as L.Layer, layerId, false);
            executeCopy();
        }
    );

    polyline.on('click', (e: any) => {
        // Let the currently active tool own the click instead of forcing
        // polyline edit mode underneath it.
        if (mapStore.activeLayerId !== null && mapStore.activeLayerId !== buttonId) {
            return;
        }

        L.DomEvent.stopPropagation(e.originalEvent ?? e);

        const isModifierClick =
            (e.originalEvent?.shiftKey || e.originalEvent?.ctrlKey || e.originalEvent?.metaKey) ??
            false;

        if (isModifierClick) {
            // Additive selection: merge this feature into the current selection
            // without opening the popup or entering edit mode.
            selectFeature(polyline as unknown as L.Layer, layerId, true);
            return;
        }

        // Non-modifier click: remember and highlight this feature so that a
        // subsequent Shift/Ctrl-click can merge with it additively.  Update
        // whenever selection mode is inactive OR the selection is currently
        // empty (e.g. user entered selection mode via the button but hasn't
        // rubber-band-dragged anything yet).  skipActivate=true prevents
        // area-selection mode from activating on a plain click.
        const selectionStore = useSelectionStore(pinia);
        if (!selectionStore.isActive || selectionStore.selected.length === 0) {
            selectFeature(polyline as unknown as L.Layer, layerId, false, true);
        }

        opts.selectForEdit();
        removeMapCursor(buttonId);
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
export function loadPolylineGeoJSON(
    geoJson: any,
    addFn: (points: L.LatLng[], historyId?: string) => void
): void {
    if (!geoJson?.features) {
        return;
    }
    geoJson.features.forEach((feature: any) => {
        const points: L.LatLng[] = [];
        const raw = feature.geometry.coordinates;
        // Legacy: coordinates wrapped in an extra array
        const coords = raw.length === 1 ? raw[0] : raw;
        coords.forEach((c: number[]) => points.push(new L.LatLng(c[1], c[0])));
        addFn(points, feature.properties?.historyId);
    });
}
