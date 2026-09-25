import * as L from 'leaflet';
import { pinia } from '../../../stores/index';
import { useMapStore } from '../../../stores/mapStore';
import { attachLtnPolygonHoverInteractions } from './ltnPolygonHover';
import { attachLtnPolygonClickHandler } from './ltnPolygonClickHandler';
import type { createLtnCursorController } from './ltnCursorController';

const BUTTON_ID = 'ltn';

interface LtnPolygonInteractionsOptions {
    map: L.Map;
    polygon: any;
    historyId: string;
    popup: L.Popup;
    labelEl: HTMLInputElement;
    colorEl: HTMLInputElement;
    refreshGroupContent: () => void;
    disposePopup: () => void;
    recomputeFeatureVisibility: () => void;
    getSelectionMode: () => 'draw' | 'edit';
    isDrawingToolEnabled: () => boolean;
    disableDrawMode: () => void;
    getEditablePolygon: () => any;
    setEditablePolygon: (polygon: any | null) => void;
    selectForEdit: () => void;
    cursorController: ReturnType<typeof createLtnCursorController>;
    defaultColor: string;
}

export function attachLtnPolygonInteractions(options: LtnPolygonInteractionsOptions): void {
    const {
        map,
        polygon,
        historyId,
        popup,
        labelEl,
        colorEl,
        refreshGroupContent,
        disposePopup,
        recomputeFeatureVisibility,
        getSelectionMode,
        isDrawingToolEnabled,
        disableDrawMode,
        getEditablePolygon,
        setEditablePolygon,
        selectForEdit,
        cursorController,
        defaultColor
    } = options;
    const mapStore = useMapStore(pinia);
    attachLtnPolygonHoverInteractions({
        map,
        polygon,
        historyId,
        popup,
        getSelectionMode,
        cursorController
    });

    polygon.on('mousedown', () => {
        if (
            mapStore.activeLayerId !== null &&
            mapStore.activeLayerId !== BUTTON_ID &&
            isDrawingToolEnabled() &&
            mapStore.drawLayerId === BUTTON_ID
        ) {
            disableDrawMode();
        }
    });

    polygon.on('mousemove', (event: any) => {
        cursorController.syncPolygonEditCursor(
            event.target?._path ?? null,
            event.originalEvent.clientX,
            event.originalEvent.clientY
        );
    });

    const disposeClickHandler = attachLtnPolygonClickHandler({
        map,
        polygon,
        historyId,
        popup,
        labelEl,
        colorEl,
        refreshGroupContent,
        recomputeFeatureVisibility,
        getEditablePolygon,
        setEditablePolygon,
        selectForEdit,
        cursorController,
        defaultColor
    });

    polygon.__disposeLtnPopup = () => {
        disposeClickHandler();
        disposePopup();
    };
}
