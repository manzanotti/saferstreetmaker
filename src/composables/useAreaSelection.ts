/**
 * useAreaSelection.ts
 *
 * Rubber-band area-selection composable.
 *
 * Activation flow:
 *   1. User clicks the "Select area" button → selectionStore.activate()
 *   2. Map dragging is disabled; crosshair cursor applied.
 *   3. User drags to draw a dashed rectangle.
 *   4. On mouseup: matching features are collected and stored in
 *      selectionStore; they are visually highlighted. Points are matched
 *      by position; polygon features by geometry intersection; polyline
 *      features by individual vertex position.
 *   5. AreaSelectionPanel shows "N features selected / Delete / Cancel".
 *   6. Delete → removes or trims features from their GeoJSON layers and
 *      calls markLayerUpdated once with a structured mutation (or no
 *      mutation for multi-layer batches) → single undo entry.
 *   7. Cancel / Escape → deactivate, clear highlights, restore map drag.
 */
import * as L from 'leaflet';
import { watch } from 'vue';
import { useMapStore, type LayerMutationEvent } from '../stores/mapStore';
import {
    useSelectionStore,
    type SelectedMarker,
    type ClipboardEntry
} from '../stores/selectionStore';
import { pinia } from '../stores/index';

const RECT_STYLE: L.PathOptions = {
    color: '#3b82f6',
    weight: 2,
    fill: true,
    fillOpacity: 0.08,
    dashArray: '6 4',
    interactive: false
};

const HIGHLIGHT_STYLE: L.PathOptions = {
    color: '#3b82f6',
    weight: 3
};

/** Style for temporary vertex handles drawn on polyline / polygon vertices. */
const VERTEX_HANDLE_STYLE: L.CircleMarkerOptions = {
    radius: 5,
    weight: 2,
    color: '#3b82f6',
    fillColor: '#ffffff',
    fillOpacity: 1,
    interactive: false
};

/** CSS class added to DivIcon marker DOM elements while selected. */
const SELECTED_CLASS = 'area-selected';

function isPlainPropertiesRecord(value: unknown): value is Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return false;
    }

    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function buildClipboardFeature(
    layerId: string,
    marker: L.Layer,
    feature: GeoJSON.Feature
): GeoJSON.Feature {
    const rawMarkerProperties = (marker as any)['properties'];
    const markerProperties = isPlainPropertiesRecord(rawMarkerProperties)
        ? rawMarkerProperties
        : null;

    if (!markerProperties) {
        return feature;
    }

    const clipboardFeature = JSON.parse(JSON.stringify(feature)) as GeoJSON.Feature;
    const markerColor = (marker as any).options?.color;

    clipboardFeature.properties = {
        ...(clipboardFeature.properties ?? {}),
        ...markerProperties
    };

    if (layerId === 'LtnCells' && typeof markerColor === 'string') {
        (clipboardFeature.properties as Record<string, unknown>).color = markerColor;
    }

    return clipboardFeature;
}

function getPolygonRings(m: L.Layer): L.LatLng[][] {
    const raw = (m as any).getLatLngs?.();
    if (!raw || !Array.isArray(raw) || raw.length === 0) {
        return [];
    }
    return Array.isArray(raw[0]) ? (raw as L.LatLng[][]) : [raw as L.LatLng[]];
}

/**
 * Flattens the LatLng collection returned by `getLatLngs()` into a single
 * array of vertices. Delegates to `getPolygonRings` so the ring-detection
 * logic lives in one place.
 */
function getPolylineLatLngs(m: L.Layer): L.LatLng[] {
    return getPolygonRings(m).flat();
}

function boundsCorners(bounds: L.LatLngBounds): L.LatLng[] {
    const southWest = bounds.getSouthWest();
    const northEast = bounds.getNorthEast();

    return [
        southWest,
        new L.LatLng(southWest.lat, northEast.lng),
        northEast,
        new L.LatLng(northEast.lat, southWest.lng)
    ];
}

function pointInRing(point: L.LatLng, ring: L.LatLng[]): boolean {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i].lng;
        const yi = ring[i].lat;
        const xj = ring[j].lng;
        const yj = ring[j].lat;

        const intersects =
            yi > point.lat !== yj > point.lat &&
            point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;

        if (intersects) {
            inside = !inside;
        }
    }
    return inside;
}

function orientation(a: L.LatLng, b: L.LatLng, c: L.LatLng): number {
    const value = (b.lng - a.lng) * (c.lat - a.lat) - (b.lat - a.lat) * (c.lng - a.lng);
    if (Math.abs(value) < 1e-9) {
        return 0;
    }
    return value > 0 ? 1 : -1;
}

function onSegment(a: L.LatLng, b: L.LatLng, c: L.LatLng): boolean {
    return (
        Math.min(a.lng, c.lng) <= b.lng &&
        b.lng <= Math.max(a.lng, c.lng) &&
        Math.min(a.lat, c.lat) <= b.lat &&
        b.lat <= Math.max(a.lat, c.lat)
    );
}

function segmentsIntersect(a1: L.LatLng, a2: L.LatLng, b1: L.LatLng, b2: L.LatLng): boolean {
    const o1 = orientation(a1, a2, b1);
    const o2 = orientation(a1, a2, b2);
    const o3 = orientation(b1, b2, a1);
    const o4 = orientation(b1, b2, a2);

    if (o1 !== o2 && o3 !== o4) {
        return true;
    }

    if (o1 === 0 && onSegment(a1, b1, a2)) {
        return true;
    }
    if (o2 === 0 && onSegment(a1, b2, a2)) {
        return true;
    }
    if (o3 === 0 && onSegment(b1, a1, b2)) {
        return true;
    }
    if (o4 === 0 && onSegment(b1, a2, b2)) {
        return true;
    }

    return false;
}

/**
 * Returns true when the rubber-band `bounds` rectangle geometrically
 * intersects the polygon layer `m`.
 *
 * Note: only the outer ring (`rings[0]`) is tested. Holes in the polygon
 * are ignored, so a selection rectangle that lies fully inside a hole will
 * still match. Current app polygons (LTN cells) never have holes, so this
 * is acceptable.
 */
export function polygonIntersectsBounds(m: L.Layer, bounds: L.LatLngBounds): boolean {
    const rings = getPolygonRings(m);
    if (rings.length === 0) {
        return false;
    }

    const outerRing = rings[0];
    const rectCorners = boundsCorners(bounds);

    // Any polygon vertex inside the rectangle.
    if (outerRing.some((vertex) => bounds.contains(vertex))) {
        return true;
    }

    // Any rectangle corner inside the polygon.
    if (rectCorners.some((corner) => pointInRing(corner, outerRing))) {
        return true;
    }

    // Any polygon edge intersects any rectangle edge.
    const rectEdges: Array<[L.LatLng, L.LatLng]> = [
        [rectCorners[0], rectCorners[1]],
        [rectCorners[1], rectCorners[2]],
        [rectCorners[2], rectCorners[3]],
        [rectCorners[3], rectCorners[0]]
    ];

    for (let index = 0; index < outerRing.length; index++) {
        const current = outerRing[index];
        const next = outerRing[(index + 1) % outerRing.length];

        if (rectEdges.some(([r1, r2]) => segmentsIntersect(current, next, r1, r2))) {
            return true;
        }
    }

    return false;
}

export function setupAreaSelection(map: L.Map): void {
    const selectionStore = useSelectionStore(pinia);
    const mapStore = useMapStore(pinia);

    let origin: L.LatLng | null = null;
    let selRect: L.Rectangle | null = null;
    let handleLayer: L.LayerGroup | null = null;
    let previousActiveLayerId: string | null = null;
    const originalStyles = new WeakMap<object, L.PathOptions>();

    // ── Activate / deactivate ──────────────────────────────────────────────
    watch(
        () => selectionStore.isActive,
        (active) => {
            if (active) {
                previousActiveLayerId = mapStore.activeLayerId;
                mapStore.setActiveLayer(null);
                map.dragging.disable();
                map.getContainer().classList.add('area-select');
                map.on('mousedown', onMouseDown as L.LeafletEventHandlerFn);
            } else {
                map.dragging.enable();
                map.getContainer().classList.remove('area-select');
                map.off('mousedown', onMouseDown as L.LeafletEventHandlerFn);
                // Clean up any in-progress drag so mid-cancel doesn't leave
                // stale mousemove/mouseup handlers attached.
                map.off('mousemove', onMouseMove as L.LeafletEventHandlerFn);
                map.off('mouseup', onMouseUp as L.LeafletEventHandlerFn);
                origin = null;
                clearHighlights();
                removeRect();
                mapStore.setActiveLayer(previousActiveLayerId);
                previousActiveLayerId = null;
            }
        },
        { flush: 'sync' }
    );

    // Escape key while selection mode is active
    map.on('keyup', (e: L.LeafletKeyboardEvent) => {
        if (e.originalEvent.key === 'Escape' && selectionStore.isActive) {
            selectionStore.deactivate();
        }
    });

    // ── Rubber-band drag ───────────────────────────────────────────────────
    function onMouseDown(e: L.LeafletMouseEvent) {
        L.DomEvent.stopPropagation(e.originalEvent);
        // Prevent the browser from starting a text-selection drag, which
        // would highlight legend text and other map-control content.
        e.originalEvent.preventDefault();
        origin = e.latlng;
        clearHighlights();
        selectionStore.clear();
        removeRect();
        map.on('mousemove', onMouseMove as L.LeafletEventHandlerFn);
        map.on('mouseup', onMouseUp as L.LeafletEventHandlerFn);
    }

    function onMouseMove(e: L.LeafletMouseEvent) {
        if (!origin) {
            return;
        }
        const bounds = L.latLngBounds(origin, e.latlng);
        if (!selRect) {
            selRect = L.rectangle(bounds, RECT_STYLE).addTo(map);
        } else {
            selRect.setBounds(bounds);
        }
    }

    function onMouseUp(e: L.LeafletMouseEvent) {
        map.off('mousemove', onMouseMove as L.LeafletEventHandlerFn);
        map.off('mouseup', onMouseUp as L.LeafletEventHandlerFn);
        if (!origin) {
            return;
        }
        const bounds = L.latLngBounds(origin, e.latlng);
        origin = null;
        const found = findMarkersInBounds(bounds);
        selectionStore.setSelected(found);
        if (found.length > 0) {
            highlightMarkers(found);
        }
    }

    // ── Marker / feature discovery ──────────────────────────────────────────
    function findMarkersInBounds(bounds: L.LatLngBounds): SelectedMarker[] {
        const found: SelectedMarker[] = [];
        for (const layer of mapStore.layers) {
            // Skip layers that have been hidden via the legend.
            if (!mapStore.visibleLayerIds.has(layer.id)) {
                continue;
            }
            layer.getLayer().eachLayer((m) => {
                const pointLatLng = (m as any).getLatLng?.() as L.LatLng | undefined;
                if (pointLatLng) {
                    // Point marker — select the whole marker if it's within bounds
                    if (bounds.contains(pointLatLng)) {
                        found.push({
                            layerId: layer.id,
                            historyId: (m as any).feature?.properties?.historyId ?? null,
                            latLng: pointLatLng,
                            marker: m
                        });
                    }
                } else if (layer.kind === 'polygon') {
                    // Polygon: select the whole feature when the rubber-band truly
                    // intersects the polygon geometry.  All polygon vertices are
                    // added as handles so the user can clearly see which polygon
                    // is selected.
                    if (polygonIntersectsBounds(m, bounds)) {
                        const historyId = (m as any).feature?.properties?.historyId ?? null;
                        for (const vertexLatLng of getPolylineLatLngs(m)) {
                            found.push({
                                layerId: layer.id,
                                historyId,
                                latLng: vertexLatLng,
                                marker: m
                            });
                        }
                    }
                } else {
                    // Polyline: vertex-level selection. Each in-bounds vertex becomes
                    // its own SelectedMarker with the same parent `marker` reference.
                    for (const vertexLatLng of getPolylineLatLngs(m)) {
                        if (bounds.contains(vertexLatLng)) {
                            found.push({
                                layerId: layer.id,
                                historyId: (m as any).feature?.properties?.historyId ?? null,
                                latLng: vertexLatLng,
                                marker: m
                            });
                        }
                    }
                }
            });
        }
        return found;
    }

    // ── Visual highlight ───────────────────────────────────────────────────
    function highlightMarkers(markers: SelectedMarker[]) {
        handleLayer?.remove();
        handleLayer = L.layerGroup().addTo(map);

        for (const { marker, latLng } of markers) {
            const isPointMarker = typeof (marker as any).getLatLng === 'function';
            if (isPointMarker) {
                if (typeof (marker as any).setStyle === 'function') {
                    // CircleMarker / SVG path — setStyle checked first because
                    // SVG elements also expose getElement(), and CSS outline
                    // has no effect on SVG.
                    const m = marker as L.CircleMarker;
                    originalStyles.set(m as object, {
                        color: (m.options as any).color,
                        weight: (m.options as any).weight
                    });
                    m.setStyle(HIGHLIGHT_STYLE);
                } else {
                    // DivIcon marker — apply CSS class to the DOM element.
                    const el = (marker as any).getElement?.() as HTMLElement | undefined;
                    if (el) {
                        el.classList.add(SELECTED_CLASS);
                    }
                }
            } else {
                // Polyline / polygon vertex — show a handle dot at the vertex
                L.circleMarker(latLng, VERTEX_HANDLE_STYLE).addTo(handleLayer!);
            }
        }
    }

    function clearHighlights() {
        for (const { marker } of selectionStore.selected) {
            const isPointMarker = typeof (marker as any).getLatLng === 'function';
            if (isPointMarker) {
                if (typeof (marker as any).setStyle === 'function') {
                    // CircleMarker / SVG path — mirror the setStyle-first priority.
                    const orig = originalStyles.get(marker as object);
                    if (orig) {
                        (marker as L.CircleMarker).setStyle(orig);
                        originalStyles.delete(marker as object);
                    }
                } else {
                    // DivIcon marker — remove the CSS class.
                    const el = (marker as any).getElement?.() as HTMLElement | undefined;
                    if (el) {
                        el.classList.remove(SELECTED_CLASS);
                    }
                }
            }
        }
        handleLayer?.remove();
        handleLayer = null;
    }

    function removeRect() {
        selRect?.remove();
        selRect = null;
    }
}

// ── Batch delete ───────────────────────────────────────────────────────────
// Exported so AreaSelectionPanel can call it directly.
export function executeAreaDelete(): void {
    const selectionStore = useSelectionStore(pinia);
    const mapStore = useMapStore(pinia);

    const selected = selectionStore.selected;
    if (selected.length === 0) {
        return;
    }

    // Accumulate per-layer data so that markLayerUpdated is called exactly
    // once after the loop. Calling it multiple times synchronously would mean
    // only the last mutation reaches the checkpoint — earlier layers would not
    // be restored on undo/redo because applyFeatureMutationReplay only operates
    // on the single layer carried by the stored mutation.
    const deletedPointsByLayer = new Map<string, unknown[]>();
    const otherMutations: Array<{
        kind: LayerMutationEvent['kind'];
        layerId: string;
        payload: unknown;
    }> = [];

    // Precompute a marker → selected-LatLng set once so the polyline path can
    // look up vertices in O(1) rather than rescanning `selected` per marker.
    const selectedLatLngsByMarker = new Map<object, Set<L.LatLng>>();
    for (const { marker, latLng } of selected) {
        const key = marker as object;
        let set = selectedLatLngsByMarker.get(key);
        if (!set) {
            set = new Set<L.LatLng>();
            selectedLatLngsByMarker.set(key, set);
        }
        set.add(latLng);
    }

    const seen = new Set<object>();
    for (const { layerId, marker } of selected) {
        if (seen.has(marker as object)) {
            continue;
        }
        seen.add(marker as object);

        const layerDef = mapStore.layers.find((l) => l.id === layerId);
        const geoJsonLayer = layerDef?.getLayer();
        if (!layerDef || !geoJsonLayer) {
            continue;
        }

        const isPointMarker = typeof (marker as any).getLatLng === 'function';

        if (isPointMarker || layerDef.kind !== 'polyline') {
            // Point markers and polygons: remove the entire feature.
            const feature = (marker as any).toGeoJSON?.();
            geoJsonLayer.removeLayer(marker as unknown as L.Layer);

            if (isPointMarker) {
                if (!deletedPointsByLayer.has(layerId)) {
                    deletedPointsByLayer.set(layerId, []);
                }
                deletedPointsByLayer.get(layerId)!.push(feature);
            } else {
                otherMutations.push({
                    kind: 'polygon-batch-delete',
                    layerId,
                    payload: { before: feature }
                });
            }
        } else {
            // Polylines: remove only the vertices that were selected,
            // leaving the rest of the line intact.
            const selectedRefs =
                selectedLatLngsByMarker.get(marker as object) ?? new Set<L.LatLng>();
            const currentLatLngs = (marker as any).getLatLngs?.() as L.LatLng[] | undefined;
            if (!currentLatLngs) {
                geoJsonLayer.removeLayer(marker as unknown as L.Layer);
                continue;
            }
            const beforeCoordinates = currentLatLngs.map((v) => [v.lng, v.lat]);
            const remaining = currentLatLngs.filter((v) => !selectedRefs.has(v));
            if (remaining.length < 2) {
                // Too few vertices left — remove the whole polyline.
                geoJsonLayer.removeLayer(marker as unknown as L.Layer);
                otherMutations.push({
                    kind: 'polyline-delete',
                    layerId,
                    payload: { before: (marker as any).toGeoJSON?.() }
                });
            } else {
                // Mutate in place; GeoJSON serialisation uses getLatLngs() so
                // the updated coordinates will be saved correctly.
                (marker as any).setLatLngs?.(remaining);
                const historyId =
                    ((marker as any).feature?.properties?.historyId as string | undefined) ?? null;
                otherMutations.push({
                    kind: 'polyline-vertices-delete',
                    layerId,
                    payload: {
                        historyId,
                        beforeCoordinates,
                        afterCoordinates: remaining.map((v) => [v.lng, v.lat])
                    }
                });
            }
        }
    }

    // Emit a single markLayerUpdated call for the entire batch.
    // Structured replay is used only for simple single-layer, single-type
    // batches; complex multi-layer or mixed-type batches fall back to
    // snapshot-based replay, which always restores all layers correctly.
    const pointLayerEntries = [...deletedPointsByLayer.entries()];
    if (otherMutations.length === 0 && pointLayerEntries.length === 1) {
        const [layerId, points] = pointLayerEntries[0];
        mapStore.markLayerUpdated({
            kind: 'point-batch-delete',
            layerId,
            payload: { points }
        });
    } else if (pointLayerEntries.length === 0 && otherMutations.length === 1) {
        const { kind, layerId, payload } = otherMutations[0];
        mapStore.markLayerUpdated({ kind, layerId, payload });
    } else {
        // Complex batch (multiple layers or mixed types): snapshot fallback
        // handles all affected layers correctly.
        mapStore.markLayerUpdated();
    }

    selectionStore.deactivate();
}

// ── Copy ───────────────────────────────────────────────────────────
// Exported so AreaSelectionPanel and the keyboard handler can call it.
export function executeCopy(): void {
    const selectionStore = useSelectionStore(pinia);
    const mapStore = useMapStore(pinia);

    const selected = selectionStore.selected;
    if (selected.length === 0) {
        return;
    }

    // Capture the selected geometry for every unique selected marker.
    const selectedLatLngsByMarker = new Map<object, Set<L.LatLng>>();
    for (const { marker, latLng } of selected) {
        const key = marker as object;
        let set = selectedLatLngsByMarker.get(key);
        if (!set) {
            set = new Set<L.LatLng>();
            selectedLatLngsByMarker.set(key, set);
        }
        set.add(latLng);
    }

    const seen = new Set<object>();
    const entries: ClipboardEntry[] = [];

    for (const { layerId, marker } of selected) {
        if (seen.has(marker as object)) {
            continue;
        }
        seen.add(marker as object);

        const layerDef = mapStore.layers.find((l) => l.id === layerId);
        if (!layerDef) {
            continue;
        }

        const sourceFeature = (marker as any).toGeoJSON?.() as GeoJSON.Feature | null | undefined;
        if (!sourceFeature) {
            continue;
        }

        const feature = buildClipboardFeature(layerId, marker, sourceFeature);

        if (layerDef.kind === 'polyline') {
            const selectedRefs =
                selectedLatLngsByMarker.get(marker as object) ?? new Set<L.LatLng>();
            const currentLatLngs = getPolylineLatLngs(marker);
            if (currentLatLngs.length === 0) {
                continue;
            }

            const selectedCoordinates = currentLatLngs
                .filter((latLng) => selectedRefs.has(latLng))
                .map((latLng) => [latLng.lng, latLng.lat]);

            // A copied polyline subset must still be a valid line.
            if (selectedCoordinates.length < 2) {
                continue;
            }

            const copiedFeature = JSON.parse(JSON.stringify(feature)) as GeoJSON.Feature;
            if (copiedFeature.geometry?.type === 'LineString') {
                (copiedFeature.geometry as GeoJSON.LineString).coordinates = selectedCoordinates;
            }
            entries.push({ layerId, feature: copiedFeature });
            continue;
        }

        entries.push({ layerId, feature });
    }

    selectionStore.copyToClipboard(entries);
}

// ── Paste ──────────────────────────────────────────────────────────
// Exported so AreaSelectionPanel and the keyboard handler can call it.
export function executePaste(): void {
    const selectionStore = useSelectionStore(pinia);
    const mapStore = useMapStore(pinia);

    const { clipboard } = selectionStore;
    if (clipboard.length === 0) {
        return;
    }

    // Group clipboard entries by layer so we call loadFromGeoJSON once per layer.
    const byLayer = new Map<string, GeoJSON.Feature[]>();
    for (const { layerId, feature } of clipboard) {
        if (!byLayer.has(layerId)) {
            byLayer.set(layerId, []);
        }
        byLayer.get(layerId)!.push(feature);
    }

    const nextVisibleLayerIds = new Set(mapStore.visibleLayerIds);

    for (const [layerId, features] of byLayer) {
        const layerDef = mapStore.layers.find((l) => l.id === layerId);
        if (!layerDef) {
            continue;
        }

        // Pasting into a hidden layer should make that layer visible so the
        // user gets immediate feedback that the paste succeeded.
        nextVisibleLayerIds.add(layerId);

        // Deep-clone each feature and assign a fresh historyId so the pasted
        // copies are independent records in the undo journal.
        const newFeatures = features.map((f) => {
            const cloned = JSON.parse(JSON.stringify(f)) as GeoJSON.Feature;
            cloned.properties = cloned.properties ?? {};
            (cloned.properties as Record<string, unknown>).historyId =
                typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                    ? crypto.randomUUID()
                    : `paste-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
            return cloned;
        });

        // loadFromGeoJSON adds features to the layer without clearing it.
        layerDef.loadFromGeoJSON({ type: 'FeatureCollection', features: newFeatures } as any);
    }

    mapStore.visibleLayerIds = nextVisibleLayerIds;

    // A single markLayerUpdated call with no structured mutation lets snapshot-
    // based undo/redo restore all affected layers correctly.
    mapStore.markLayerUpdated();
}
