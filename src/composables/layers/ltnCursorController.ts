import * as L from 'leaflet';
import { removeMapCursor, setMapCursor, setMouseMarkerCursor } from './featureCursors';
import { isHoveringPolygonFill, isHoveringPolygonStroke } from './ltnSvgHitTesting';

export const LTN_CURSOR_CSS = 'ltn-cell';

interface LtnCursorControllerOptions {
    getSelectionMode: () => 'draw' | 'edit';
    isLayerActive: () => boolean;
    isReadOnly: () => boolean;
    isPointFeatureElement: (element: Element) => boolean;
    isGroupedFeatureElement: (element: Element) => boolean;
}

export function createLtnCursorController(map: L.Map, options: LtnCursorControllerOptions) {
    let pendingCursorEvent: L.LeafletMouseEvent | null = null;
    let cursorSyncFrameId: number | null = null;
    let lastCursorStyledElement: HTMLElement | SVGElement | null = null;

    const setFeatureCursor = (element: Element | null, cursor: string | null): void => {
        if (
            lastCursorStyledElement &&
            lastCursorStyledElement !== element &&
            'style' in lastCursorStyledElement
        ) {
            lastCursorStyledElement.style.removeProperty('cursor');
        }

        if (element && (element instanceof HTMLElement || element instanceof SVGElement)) {
            if (cursor === null) {
                element.style.removeProperty('cursor');
                lastCursorStyledElement = null;
            } else {
                element.style.cursor = cursor;
                lastCursorStyledElement = element;
            }
        } else {
            lastCursorStyledElement = null;
        }
    };

    const applyMouseMarkerCursor = (event: L.LeafletMouseEvent): void => {
        const hoverStack = document.elementsFromPoint(
            event.originalEvent.clientX,
            event.originalEvent.clientY
        );
        const mouseMarker = document.querySelector('.leaflet-mouse-marker') as HTMLElement | null;
        if (!mouseMarker) {
            return;
        }

        if (options.isReadOnly()) {
            setFeatureCursor(null, null);
            const hoveredFeature = hoverStack.find(
                (element) =>
                    element.classList.contains('leaflet-interactive') ||
                    options.isPointFeatureElement(element)
            );
            if (!hoveredFeature || !options.isGroupedFeatureElement(hoveredFeature)) {
                mouseMarker.style.cursor = 'default';
                return;
            }
        }

        const isHoveringPointFeature = hoverStack.some((element) => {
            return element !== mouseMarker && options.isPointFeatureElement(element);
        });

        if (isHoveringPointFeature && options.getSelectionMode() !== 'draw') {
            setFeatureCursor(null, null);
            mouseMarker.style.cursor = 'pointer';
            return;
        }

        const isHoveringLtnFeature = hoverStack.some((element) => {
            return (
                element !== mouseMarker &&
                element.classList.contains('leaflet-interactive') &&
                element.classList.contains(LTN_CURSOR_CSS)
            );
        });

        if (options.getSelectionMode() === 'edit') {
            const hoveredLtnFeature = hoverStack.find((element) => {
                return (
                    element !== mouseMarker &&
                    element.classList.contains('leaflet-interactive') &&
                    element.classList.contains(LTN_CURSOR_CSS)
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
                    setFeatureCursor(hoveredLtnFeature, 'crosshair');
                    mouseMarker.style.cursor = 'crosshair';
                } else if (isFillHit) {
                    setFeatureCursor(hoveredLtnFeature, 'pointer');
                    mouseMarker.style.cursor = 'pointer';
                } else {
                    setFeatureCursor(hoveredLtnFeature, null);
                    mouseMarker.style.cursor = 'grab';
                }
                return;
            }

            setFeatureCursor(null, null);

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
            setFeatureCursor(null, null);
            mouseMarker.style.cursor = 'pointer';
        } else {
            setFeatureCursor(null, null);
            mouseMarker.style.removeProperty('cursor');
        }
    };

    const syncPolygonEditCursor = (
        polygonElement: Element | null,
        clientX: number,
        clientY: number
    ): void => {
        if (options.getSelectionMode() !== 'edit' || !options.isLayerActive() || !polygonElement) {
            return;
        }

        const isStrokeHit = isHoveringPolygonStroke(polygonElement, clientX, clientY);
        const isFillHit = isHoveringPolygonFill(polygonElement, clientX, clientY);

        if (isStrokeHit) {
            setFeatureCursor(polygonElement, 'crosshair');
            setMouseMarkerCursor('crosshair');
        } else if (isFillHit) {
            setFeatureCursor(polygonElement, 'pointer');
            setMouseMarkerCursor('pointer');
        } else {
            setFeatureCursor(polygonElement, null);
            setMouseMarkerCursor('grab');
        }
    };

    const syncMouseMarkerCursor = (event: L.LeafletMouseEvent): void => {
        pendingCursorEvent = event;
        if (cursorSyncFrameId !== null) {
            return;
        }

        cursorSyncFrameId = requestAnimationFrame(() => {
            cursorSyncFrameId = null;
            const latestEvent = pendingCursorEvent;
            pendingCursorEvent = null;

            if (latestEvent) {
                applyMouseMarkerCursor(latestEvent);
            }
        });
    };

    const start = (): void => {
        setMapCursor(LTN_CURSOR_CSS);
        map.on('mousemove', syncMouseMarkerCursor as L.LeafletEventHandlerFn);
    };

    const enterEditMode = (): void => {
        removeMapCursor(LTN_CURSOR_CSS);
    };

    const resetPolygonCursor = (): void => {
        setFeatureCursor(null, null);
        setMouseMarkerCursor('grab');
    };

    const stop = (): void => {
        map.off('mousemove', syncMouseMarkerCursor as L.LeafletEventHandlerFn);
        if (cursorSyncFrameId !== null) {
            cancelAnimationFrame(cursorSyncFrameId);
            cursorSyncFrameId = null;
        }
        pendingCursorEvent = null;
        setFeatureCursor(null, null);
        setMouseMarkerCursor(null);
        removeMapCursor(LTN_CURSOR_CSS);
    };

    return { start, enterEditMode, resetPolygonCursor, stop, syncPolygonEditCursor };
}
