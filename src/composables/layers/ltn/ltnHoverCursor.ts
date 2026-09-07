// ── LTN hover cursor helpers ──────────────────────────────────────────────
// Extracted from useLtnLayer.ts. These functions need small bits of mutable
// state (the last element styled with a cursor) — callers pass a shared
// `CursorState` object so state persists across calls exactly as it did
// when these were closures.

import * as L from 'leaflet';
import { isPointFeatureElement, findFeatureGroupIdByElement } from '../layerUtils';
import { useSettingsStore } from '../../../stores/settingsStore';
import { pinia } from '../../../stores/index';

export interface CursorState {
    lastCursorStyledElement: HTMLElement | SVGElement | null;
}

export const toLocalSvgPoint = (path: SVGGeometryElement, clientX: number, clientY: number) => {
    const svg = path.ownerSVGElement;
    const matrix = path.getScreenCTM();
    if (!svg || !matrix) {
        return null;
    }

    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    return point.matrixTransform(matrix.inverse());
};

export const isHoveringPolygonStroke = (
    element: Element,
    clientX: number,
    clientY: number
): boolean => {
    if (!(element instanceof SVGGeometryElement) || !('isPointInStroke' in element)) {
        return false;
    }

    const localPoint = toLocalSvgPoint(element, clientX, clientY);
    if (!localPoint) {
        return false;
    }

    return element.isPointInStroke(localPoint);
};

export const isHoveringPolygonFill = (
    element: Element,
    clientX: number,
    clientY: number
): boolean => {
    if (!(element instanceof SVGGeometryElement) || !('isPointInFill' in element)) {
        return false;
    }

    const localPoint = toLocalSvgPoint(element, clientX, clientY);
    if (!localPoint) {
        return false;
    }

    return element.isPointInFill(localPoint);
};

export const setFeatureCursor = (
    state: CursorState,
    element: Element | null,
    cursor: string | null
): void => {
    if (
        state.lastCursorStyledElement &&
        state.lastCursorStyledElement !== element &&
        'style' in state.lastCursorStyledElement
    ) {
        state.lastCursorStyledElement.style.removeProperty('cursor');
    }

    if (element && (element instanceof HTMLElement || element instanceof SVGElement)) {
        if (cursor === null) {
            element.style.removeProperty('cursor');
            state.lastCursorStyledElement = null;
        } else {
            element.style.cursor = cursor;
            state.lastCursorStyledElement = element;
        }
    } else {
        state.lastCursorStyledElement = null;
    }
};

export const applyMouseMarkerCursor = (
    event: L.LeafletMouseEvent,
    state: CursorState,
    selectionMode: 'draw' | 'edit',
    cursorCss: string
): void => {
    const hoverStack = document.elementsFromPoint(
        event.originalEvent.clientX,
        event.originalEvent.clientY
    );
    const mouseMarker = document.querySelector('.leaflet-mouse-marker') as HTMLElement | null;
    if (!mouseMarker) {
        return;
    }

    if (useSettingsStore(pinia).readOnly) {
        setFeatureCursor(state, null, null);
        const hoveredFeature = hoverStack.find(
            (element) =>
                element.classList.contains('leaflet-interactive') || isPointFeatureElement(element)
        );
        if (!hoveredFeature || !findFeatureGroupIdByElement(hoveredFeature)) {
            mouseMarker.style.cursor = 'default';
            return;
        }
    }

    const isHoveringPointFeature = hoverStack.some((element) => {
        return element !== mouseMarker && isPointFeatureElement(element);
    });

    if (isHoveringPointFeature && selectionMode !== 'draw') {
        setFeatureCursor(state, null, null);
        mouseMarker.style.cursor = 'pointer';
        return;
    }

    const isHoveringLtnFeature = hoverStack.some((element) => {
        return (
            element !== mouseMarker &&
            element.classList.contains('leaflet-interactive') &&
            element.classList.contains(cursorCss)
        );
    });

    if (selectionMode === 'edit') {
        const hoveredLtnFeature = hoverStack.find((element) => {
            return (
                element !== mouseMarker &&
                element.classList.contains('leaflet-interactive') &&
                element.classList.contains(cursorCss)
            );
        });

        if (hoveredLtnFeature) {
            const isStrokeHit = isHoveringPolygonStroke(
                hoveredLtnFeature,
                event.originalEvent.clientX,
                event.originalEvent.clientY
            );
            const isFillHit = isHoveringPolygonFill(
                hoveredLtnFeature,
                event.originalEvent.clientX,
                event.originalEvent.clientY
            );

            if (isStrokeHit) {
                setFeatureCursor(state, hoveredLtnFeature, 'crosshair');
                mouseMarker.style.cursor = 'crosshair';
            } else if (isFillHit) {
                setFeatureCursor(state, hoveredLtnFeature, 'pointer');
                mouseMarker.style.cursor = 'pointer';
            } else {
                setFeatureCursor(state, hoveredLtnFeature, null);
                mouseMarker.style.cursor = 'grab';
            }
            return;
        }

        setFeatureCursor(state, null, null);

        const isHoveringAnyInteractiveShape = hoverStack.some((element) => {
            return (
                element !== mouseMarker &&
                (element.classList.contains('leaflet-interactive') ||
                    element.classList.contains('leaflet-marker-icon'))
            );
        });

        mouseMarker.style.cursor = isHoveringAnyInteractiveShape ? 'pointer' : 'grab';
        return;
    }

    if (isHoveringLtnFeature) {
        setFeatureCursor(state, null, null);
        mouseMarker.style.cursor = 'pointer';
    } else {
        setFeatureCursor(state, null, null);
        mouseMarker.style.removeProperty('cursor');
    }
};

export interface MouseMarkerCursorSyncState {
    pendingCursorEvent: L.LeafletMouseEvent | null;
    cursorSyncFrameId: number | null;
}

export const syncMouseMarkerCursor = (
    event: L.LeafletMouseEvent,
    syncState: MouseMarkerCursorSyncState,
    cursorState: CursorState,
    selectionMode: 'draw' | 'edit',
    cursorCss: string
): void => {
    syncState.pendingCursorEvent = event;
    if (syncState.cursorSyncFrameId !== null) {
        return;
    }

    syncState.cursorSyncFrameId = requestAnimationFrame(() => {
        syncState.cursorSyncFrameId = null;
        const latestEvent = syncState.pendingCursorEvent;
        syncState.pendingCursorEvent = null;

        if (latestEvent) {
            applyMouseMarkerCursor(latestEvent, cursorState, selectionMode, cursorCss);
        }
    });
};

export const syncPolygonEditCursor = (
    polygonElement: Element | null,
    clientX: number,
    clientY: number,
    state: CursorState,
    selectionMode: 'draw' | 'edit',
    isActiveLayer: boolean,
    setMouseMarkerCursor: (cursor: string | null) => void
): void => {
    if (selectionMode !== 'edit' || !isActiveLayer || !polygonElement) {
        return;
    }

    const isStrokeHit = isHoveringPolygonStroke(polygonElement, clientX, clientY);
    const isFillHit = isHoveringPolygonFill(polygonElement, clientX, clientY);

    if (isStrokeHit) {
        setFeatureCursor(state, polygonElement, 'crosshair');
        setMouseMarkerCursor('crosshair');
    } else if (isFillHit) {
        setFeatureCursor(state, polygonElement, 'pointer');
        setMouseMarkerCursor('pointer');
    } else {
        setFeatureCursor(state, polygonElement, null);
        setMouseMarkerCursor('grab');
    }
};
