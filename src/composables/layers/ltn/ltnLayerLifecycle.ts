import * as L from 'leaflet';
import { watch } from 'vue';
import { pinia } from '../../../stores/index';
import { useMapStore } from '../../../stores/mapStore';
import { useSelectionStore } from '../../../stores/selectionStore';
import { applySelectionHighlights } from '../../useAreaSelection';
import { recomputeFeatureVisibility } from '../../useGroups';
import type { createLtnCursorController } from './ltnCursorController';
import type { createLtnDrawController } from './ltnDrawController';

export interface LtnLayerState {
    selected: boolean;
    visible: boolean;
    selectionMode: 'draw' | 'edit';
    editablePolygon: any;
    disposed: boolean;
}

interface LtnLayerLifecycleOptions {
    map: L.Map;
    geoJsonLayer: L.GeoJSON;
    buttonId: string;
    state: LtnLayerState;
    drawController: ReturnType<typeof createLtnDrawController>;
    cursorController: ReturnType<typeof createLtnCursorController>;
    syncTooltipVisibility: (polygon: any) => void;
}

export function createLtnLayerLifecycle(options: LtnLayerLifecycleOptions) {
    const { map, geoJsonLayer, buttonId, state, drawController, cursorController } = options;
    const mapStore = useMapStore(pinia);

    const handleLayerRemove = (event: any): void => {
        event.layer?.editing?.disable?.();
        if (event.layer === state.editablePolygon) {
            state.editablePolygon = null;
        }
        drawController.handleLayerRemoved(event.layer);
        event.layer?.__disposeLtnPopup?.();
        event.layer?.__disposeLtnHoverPopup?.();
        event.layer?.off?.();
    };
    geoJsonLayer.on('layerremove', handleLayerRemove);

    const handleZoomEnd = (): void => {
        geoJsonLayer.eachLayer((layer: any) => {
            options.syncTooltipVisibility(layer);
        });
    };
    map.on('zoomend', handleZoomEnd);

    const stopActiveLayerWatch = watch(
        () => mapStore.activeLayerId,
        (newId) => {
            const shouldBeSelected = newId === buttonId;
            if (shouldBeSelected && !state.selected) {
                state.selected = true;
                cursorController.start();
                if (state.selectionMode === 'draw') {
                    drawController.enable();
                }
            } else if (!shouldBeSelected && state.selected) {
                state.selected = false;
                drawController.disable();
                drawController.closeNamingPopup();
                state.editablePolygon?.editing?.disable();
                state.editablePolygon = null;
                recomputeFeatureVisibility();
                cursorController.stop();
                state.selectionMode = 'draw';
            }
        },
        { flush: 'sync' }
    );

    const dispose = (): void => {
        if (state.disposed) {
            return;
        }
        state.disposed = true;
        const selectionStore = useSelectionStore(pinia);
        const previousSelection = selectionStore.selected;
        const ltnSelection = previousSelection.filter((entry) => entry.layerId === 'LtnCells');
        const removedMarkers = new Set(ltnSelection.map((entry) => entry.marker));
        for (const marker of removedMarkers) {
            const entry = ltnSelection.find((selected) => selected.marker === marker);
            if (entry) {
                selectionStore.removeSelectedFeature(marker, entry);
            }
        }
        if (ltnSelection.length > 0) {
            applySelectionHighlights(selectionStore.selected, true, previousSelection);
        }

        stopActiveLayerWatch();
        drawController.dispose();
        state.editablePolygon?.editing?.disable();
        state.editablePolygon = null;
        recomputeFeatureVisibility();
        map.off('zoomend', handleZoomEnd);
        geoJsonLayer.off('layerremove', handleLayerRemove);
        geoJsonLayer.eachLayer((layer: any) => layer.__disposeLtnPopup?.());
        geoJsonLayer.eachLayer((layer: any) => layer.__disposeLtnHoverPopup?.());
        geoJsonLayer.eachLayer((layer: any) => layer.off?.());
        map.removeLayer(geoJsonLayer);
        geoJsonLayer.clearLayers();
        cursorController.stop();
        state.selected = false;
        state.selectionMode = 'draw';
        state.visible = false;
        if (mapStore.activeLayerId === buttonId) {
            mapStore.setActiveLayer(null);
        }
        if (mapStore.drawLayerId === buttonId) {
            mapStore.setDrawLayer(null);
        }
        mapStore.visibleLayerIds = new Set(
            [...mapStore.visibleLayerIds].filter((id) => id !== 'LtnCells')
        );
    };

    return { dispose };
}
