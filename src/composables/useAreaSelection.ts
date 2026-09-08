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
import { isFeatureGroupHidden } from '../features/groups/featureVisibility';
import { getPolylineLatLngs, polygonIntersectsBounds } from '../geometry/leafletGeometry';
import { SelectionHighlighter } from '../features/selection/SelectionHighlighter';
import { AreaSelectionController } from '../features/selection/AreaSelectionController';
import {
    applySelectionHighlights,
    buildFeatureSelectionEntries,
    clearFeatureHighlight,
    executeAreaDelete,
    executeCopy,
    executePaste,
    releaseSelectionHighlighter,
    selectFeature,
    setSelectionHighlighter
} from '../features/selection/featureSelection';

export { polygonIntersectsBounds } from '../geometry/leafletGeometry';
export {
    applySelectionHighlights,
    buildFeatureSelectionEntries,
    clearFeatureHighlight,
    executeAreaDelete,
    executeCopy,
    executePaste,
    selectFeature
} from '../features/selection/featureSelection';

/**
 * Build SelectedMarker entries for a single feature. For point markers this is
 * one entry at the marker's position; for polyline/polygon features it is one
 * entry per vertex. Used by popup-copy, click and modifier-click selection
 * paths so they produce the same SelectedMarker shape that executeCopy /
 * executeAreaDelete / grouping already understand.
 */
export function setupAreaSelection(map: L.Map): () => void {
    const selectionStore = useSelectionStore(pinia);
    const mapStore = useMapStore(pinia);
    const highlighter = new SelectionHighlighter(map);
    setSelectionHighlighter(highlighter);
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
                if (isFeatureGroupHidden(m)) {
                    return;
                }
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
        releaseSelectionHighlighter(highlighter);
    };
}
