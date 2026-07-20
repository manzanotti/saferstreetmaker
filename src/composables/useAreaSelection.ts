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
import { useMapStore } from '../stores/mapStore';
import { useSelectionStore, type SelectedMarker } from '../stores/selectionStore';
import { pinia } from '../stores/index';
import { getFeatureHistoryId } from './layers/layerUtils';
import { useGroupStore } from '../stores/groupStore';
import { getPolylineLatLngs, polygonIntersectsBounds } from '../geometry/leafletGeometry';
import { SelectionHighlighter } from '../features/selection/SelectionHighlighter';
import { AreaSelectionController } from '../features/selection/AreaSelectionController';
import {
    copySelection,
    deleteSelection,
    pasteSelection,
    type SelectionCommandContext
} from '../features/selection/selectionCommands';

export { polygonIntersectsBounds } from '../geometry/leafletGeometry';

let selectionHighlighter: SelectionHighlighter | null = null;

/**
 * Build SelectedMarker entries for a single feature. For point markers this is
 * one entry at the marker's position; for polyline/polygon features it is one
 * entry per vertex. Used by popup-copy, click and modifier-click selection
 * paths so they produce the same SelectedMarker shape that executeCopy /
 * executeAreaDelete / grouping already understand.
 */
export function buildFeatureSelectionEntries(marker: L.Layer, layerId: string): SelectedMarker[] {
    const historyId = getFeatureHistoryId(marker);
    const anyMarker = marker as unknown as {
        getLatLng?: () => L.LatLng;
        getLatLngs?: () => unknown;
    };

    // Point marker: a single entry from getLatLng(). Polylines/polygons expose
    // getLatLngs() instead, so exclude those here.
    if (typeof anyMarker.getLatLng === 'function' && typeof anyMarker.getLatLngs !== 'function') {
        const latLng = anyMarker.getLatLng();
        return latLng ? [{ layerId, historyId, latLng, marker }] : [];
    }

    return getPolylineLatLngs(marker).map((latLng) => ({ layerId, historyId, latLng, marker }));
}

/**
 * Programmatically select a single polyline or polygon feature.
 *
 * When `additive` is true the feature is merged into the existing selection
 * (no-op if the marker is already present).  When false the current selection
 * is replaced with just this feature.
 *
 * Activates area-selection mode unless `skipActivate` is true.  Pass
 * `skipActivate = true` when tracking a feature on a normal (non-modifier)
 * click so selection mode doesn't activate prematurely — the user will
 * trigger activation with their subsequent Shift/Ctrl-click.
 *
 * Vertex handles are drawn in all cases so the user gets immediate visual
 * feedback about which feature is "remembered".
 */
export function selectFeature(
    marker: L.Layer,
    layerId: string,
    additive: boolean,
    skipActivate = false
): void {
    const selectionStore = useSelectionStore(pinia);
    const entries = buildFeatureSelectionEntries(marker, layerId);
    if (entries.length === 0) {
        return;
    }

    if (additive) {
        const addedEntries = selectionStore.mergeSelected(entries);

        if (!skipActivate && !selectionStore.isActive) {
            selectionStore.activate();
        }

        if (addedEntries.length > 0) {
            selectionHighlighter?.add(addedEntries);
        }

        return;
    }

    const previousEntries = selectionStore.selected;
    selectionStore.setSelected(entries);

    if (!skipActivate && !selectionStore.isActive) {
        selectionStore.activate();
    }

    selectionHighlighter?.replace(previousEntries, entries);
}

export function setupAreaSelection(map: L.Map): () => void {
    const selectionStore = useSelectionStore(pinia);
    const mapStore = useMapStore(pinia);
    const highlighter = new SelectionHighlighter(map);
    selectionHighlighter = highlighter;
    const controller = new AreaSelectionController({
        map,
        highlighter,
        getSelected: () => selectionStore.selected,
        setSelected: (markers) => selectionStore.setSelected(markers),
        mergeSelected: (markers) => selectionStore.mergeSelected(markers),
        clearSelection: () => selectionStore.clear(),
        setLastAreaBounds: (bounds) => selectionStore.setLastAreaBounds(bounds),
        findMarkersInBounds,
        getDrawLayerId: () => mapStore.drawLayerId,
        setDrawLayer: (id) => mapStore.setDrawLayer(id),
        clearAddToGroupTarget: () => useGroupStore(pinia).setAddToGroupId(null),
        isSelectionActive: () => selectionStore.isActive,
        deactivateSelection: () => selectionStore.deactivate()
    });

    // ── Activate / deactivate ──────────────────────────────────────────────
    const stopSelectionWatch = watch(
        () => selectionStore.isActive,
        (active) => {
            if (active) {
                controller.activate();
            } else {
                controller.deactivate();
            }
        },
        { flush: 'sync' }
    );

    // ── Clean up pre-selection handles on layer deactivation ───────────────
    // When a polyline/polygon is clicked normally (no modifier) its vertex
    // handles are drawn speculatively so a subsequent Shift/Ctrl-click can
    // add to them. If the user exits that editing context (Escape, toolbar
    // button click, etc.) without doing a modifier-click, the handles become
    // stale. Clearing them when activeLayerId returns to null, while
    // selection mode is not yet active, discards those stale handles.
    const stopActiveLayerWatch = watch(
        () => mapStore.activeLayerId,
        (newId) => {
            if (newId === null && !selectionStore.isActive && selectionStore.selected.length > 0) {
                highlighter.clear(selectionStore.selected);
                selectionStore.clear();
            }
        },
        { flush: 'sync' }
    );

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
                            historyId: getFeatureHistoryId(m),
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
                        const historyId = getFeatureHistoryId(m);
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
                                historyId: getFeatureHistoryId(m),
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

    return () => {
        selectionStore.deactivate();
        stopSelectionWatch();
        stopActiveLayerWatch();
        controller.dispose();
        if (selectionHighlighter === highlighter) {
            selectionHighlighter = null;
        }
    };
}

/**
 * Apply visual selection highlights to an explicit set of SelectedMarker entries.
 * Exported so useGroups (and other external callers) can trigger highlights
 * without going through selectFeature.
 *
 * When `replace` is true (default), existing highlights are cleared first.
 */
export function applySelectionHighlights(
    markers: SelectedMarker[],
    replace = true,
    previousMarkers = useSelectionStore(pinia).selected
): void {
    if (replace) {
        selectionHighlighter?.replace(previousMarkers, markers);
    } else {
        selectionHighlighter?.add(markers);
    }
}

/**
 * Clear the vertex handles and selection state left over from a single-feature
 * click selection. Call this after deleting a feature via its popup so its
 * selection handles (e.g. polyline/polygon vertex dots) do not linger on the
 * map after the feature is gone. No-op while a rubber-band area selection is
 * active — that flow manages its own cleanup.
 */
export function clearFeatureHighlight(): void {
    const selectionStore = useSelectionStore(pinia);
    if (selectionStore.isActive) {
        return;
    }
    selectionHighlighter?.clear(selectionStore.selected);
    selectionStore.clear();
}

function getSelectionCommandContext(): SelectionCommandContext {
    const selectionStore = useSelectionStore(pinia);
    const mapStore = useMapStore(pinia);
    return {
        selected: selectionStore.selected,
        clipboard: selectionStore.clipboard,
        layers: mapStore.layers,
        visibleLayerIds: mapStore.visibleLayerIds,
        setVisibleLayerIds: (ids) => (mapStore.visibleLayerIds = ids),
        copyToClipboard: (entries) => selectionStore.copyToClipboard(entries),
        deactivateSelection: () => selectionStore.deactivate(),
        markLayerUpdated: (mutation) => {
            if (mutation) {
                mapStore.markLayerUpdated(mutation);
            } else {
                mapStore.markLayerUpdated();
            }
        }
    };
}

export function executeAreaDelete(): void {
    deleteSelection(getSelectionCommandContext());
}

export function executeCopy(): void {
    copySelection(getSelectionCommandContext());
}

export function executePaste(): void {
    pasteSelection(getSelectionCommandContext());
}
