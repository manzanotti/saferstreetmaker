import * as L from 'leaflet';
import { watch } from 'vue';
import { useMapStore } from '../../stores/mapStore';
import { pinia } from '../../stores/index';
import {
    setMapCursor,
    removeMapCursor,
    buildToolbarButton,
    buildLegendEntry,
    buildPopupActionControl,
    getPointSelectCursor,
    isPointFeatureElement,
    setMouseMarkerCursor,
    buildHistoryId
} from './layerUtils';
import type { IMapLayer } from './IMapLayer';
import { type EditablePolylineLayer } from './usePolylineLayer';
import { selectFeature, executeCopy } from '../useAreaSelection';
import { useSelectionStore } from '../../stores/selectionStore';

const COLOUR = '#cc00cc';
const BUTTON_ID = 'ltn';
const CURSOR_CSS = 'ltn-cell';

export function createLtnLayer(map: L.Map): EditablePolylineLayer {
    const mapStore = useMapStore(pinia);
    const geoJsonLayer = new L.GeoJSON(undefined, { pane: 'ltns' });
    let _selected = false;
    let _visible = false;
    let _drawingTool: any = null;
    let _ltnTitle = '1';
    let selectionMode: 'draw' | 'edit' = 'draw';
    let pendingCursorEvent: L.LeafletMouseEvent | null = null;
    let cursorSyncFrameId: number | null = null;
    let lastCursorStyledElement: HTMLElement | SVGElement | null = null;

    const getPolygonHistoryFeature = (polygon: any) => {
        const feature = polygon.toGeoJSON() as any;
        feature.properties = feature.properties ?? {};
        feature.properties.label = polygon['properties']?.label ?? '';
        feature.properties.color = polygon.options?.color ?? COLOUR;
        feature.properties.historyId = polygon['properties']?.historyId ?? '';
        return feature;
    };

    type PolygonPointChange =
        | {
              type: 'update';
              ringIndex: number;
              pointIndex: number;
              before: number[];
              after: number[];
          }
        | {
              type: 'insert';
              ringIndex: number;
              pointIndex: number;
              after: number[];
          }
        | {
              type: 'delete';
              ringIndex: number;
              pointIndex: number;
              before: number[];
          };

    const buildPolygonPointChanges = (
        beforeCoordinates: number[][][],
        afterCoordinates: number[][][]
    ) => {
        if (beforeCoordinates.length !== afterCoordinates.length) {
            return null;
        }

        const pointChanges = beforeCoordinates.flatMap((beforeRing, ringIndex) => {
            const afterRing = afterCoordinates[ringIndex];
            if (!Array.isArray(afterRing)) {
                return [];
            }

            let prefix = 0;
            while (
                prefix < beforeRing.length &&
                prefix < afterRing.length &&
                beforeRing[prefix][0] === afterRing[prefix][0] &&
                beforeRing[prefix][1] === afterRing[prefix][1]
            ) {
                prefix++;
            }

            let suffix = 0;
            while (
                suffix < beforeRing.length - prefix &&
                suffix < afterRing.length - prefix &&
                beforeRing[beforeRing.length - 1 - suffix][0] ===
                    afterRing[afterRing.length - 1 - suffix][0] &&
                beforeRing[beforeRing.length - 1 - suffix][1] ===
                    afterRing[afterRing.length - 1 - suffix][1]
            ) {
                suffix++;
            }

            const beforeMiddle = beforeRing.slice(prefix, beforeRing.length - suffix);
            const afterMiddle = afterRing.slice(prefix, afterRing.length - suffix);
            const ringChanges: PolygonPointChange[] = [];
            const sharedLength = Math.min(beforeMiddle.length, afterMiddle.length);

            for (let pointIndex = 0; pointIndex < sharedLength; pointIndex++) {
                const beforePoint = beforeMiddle[pointIndex];
                const afterPoint = afterMiddle[pointIndex];
                if (
                    !Array.isArray(afterPoint) ||
                    beforePoint.length !== 2 ||
                    afterPoint.length !== 2
                ) {
                    return [];
                }

                if (beforePoint[0] === afterPoint[0] && beforePoint[1] === afterPoint[1]) {
                    continue;
                }

                ringChanges.push({
                    type: 'update',
                    ringIndex,
                    pointIndex: prefix + pointIndex,
                    before: [beforePoint[0], beforePoint[1]],
                    after: [afterPoint[0], afterPoint[1]]
                });
            }

            if (beforeMiddle.length > afterMiddle.length) {
                for (
                    let pointIndex = sharedLength;
                    pointIndex < beforeMiddle.length;
                    pointIndex++
                ) {
                    const beforePoint = beforeMiddle[pointIndex];
                    if (beforePoint.length !== 2) {
                        return [];
                    }

                    ringChanges.push({
                        type: 'delete',
                        ringIndex,
                        pointIndex: prefix + sharedLength,
                        before: [beforePoint[0], beforePoint[1]]
                    });
                }
            } else if (afterMiddle.length > beforeMiddle.length) {
                for (let pointIndex = sharedLength; pointIndex < afterMiddle.length; pointIndex++) {
                    const afterPoint = afterMiddle[pointIndex];
                    if (!Array.isArray(afterPoint) || afterPoint.length !== 2) {
                        return [];
                    }

                    ringChanges.push({
                        type: 'insert',
                        ringIndex,
                        pointIndex: prefix + pointIndex,
                        after: [afterPoint[0], afterPoint[1]]
                    });
                }
            }

            return ringChanges;
        });

        return pointChanges.length > 0 ? pointChanges : null;
    };

    const getPolygonMutationPayload = (beforeFeature: any, afterFeature: any) => {
        const beforeCoordinates = beforeFeature?.geometry?.coordinates ?? [];
        const afterCoordinates = afterFeature?.geometry?.coordinates ?? [];
        const pointChanges = buildPolygonPointChanges(beforeCoordinates, afterCoordinates);

        return {
            historyId:
                afterFeature?.properties?.historyId ?? beforeFeature?.properties?.historyId ?? '',
            ...(pointChanges
                ? { pointChanges }
                : {
                      beforeCoordinates,
                      afterCoordinates
                  }),
            beforeLabel: beforeFeature?.properties?.label ?? '',
            afterLabel: afterFeature?.properties?.label ?? '',
            beforeColor: beforeFeature?.properties?.color ?? COLOUR,
            afterColor: afterFeature?.properties?.color ?? COLOUR
        };
    };

    const shouldShowLabel = (label: string): boolean => {
        return map.getZoom() >= 14 && label.length > 0;
    };

    const syncTooltipVisibility = (polygon: any): void => {
        const label = polygon['properties']?.label ?? '';
        if (shouldShowLabel(label)) {
            polygon.openTooltip?.();
        } else {
            polygon.closeTooltip?.();
        }
    };

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

    const toLocalSvgPoint = (path: SVGGeometryElement, clientX: number, clientY: number) => {
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

    const isHoveringPolygonStroke = (
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

    const isHoveringPolygonFill = (element: Element, clientX: number, clientY: number): boolean => {
        if (!(element instanceof SVGGeometryElement) || !('isPointInFill' in element)) {
            return false;
        }

        const localPoint = toLocalSvgPoint(element, clientX, clientY);
        if (!localPoint) {
            return false;
        }

        return element.isPointInFill(localPoint);
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

        const isHoveringPointFeature = hoverStack.some((element) => {
            return element !== mouseMarker && isPointFeatureElement(element);
        });

        if (isHoveringPointFeature) {
            setFeatureCursor(null, null);
            mouseMarker.style.cursor = getPointSelectCursor();
            return;
        }

        const isHoveringLtnFeature = hoverStack.some((element) => {
            return (
                element !== mouseMarker &&
                element.classList.contains('leaflet-interactive') &&
                element.classList.contains(CURSOR_CSS)
            );
        });

        if (selectionMode === 'edit') {
            const hoveredLtnFeature = hoverStack.find((element) => {
                return (
                    element !== mouseMarker &&
                    element.classList.contains('leaflet-interactive') &&
                    element.classList.contains(CURSOR_CSS)
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
        if (selectionMode !== 'edit' || mapStore.activeLayerId !== BUTTON_ID || !polygonElement) {
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

    // ── Add a single LTN polygon ─────────────────────────────────────────────
    const addLtnCell = (
        points: L.LatLng[],
        label: string,
        color: string,
        historyId = buildHistoryId('ltn')
    ) => {
        const polygon = new L.Polygon(points, {
            color: color || COLOUR,
            fillOpacity: 0.2,
            weight: 5,
            pane: 'ltns',
            className: 'ltn-cell'
        });

        polygon.on('edit', () => {
            const previousFeature =
                (polygon as any)['historyFeature'] ?? getPolygonHistoryFeature(polygon);
            const nextFeature = getPolygonHistoryFeature(polygon);
            mapStore.markLayerUpdated({
                kind: 'polygon-edit',
                layerId: 'LtnCells',
                payload: getPolygonMutationPayload(previousFeature, nextFeature)
            });
            (polygon as any)['historyFeature'] = nextFeature;
        });

        polygon.on('mousemove', (e: any) => {
            syncPolygonEditCursor(
                (e.target as any)?._path ?? null,
                e.originalEvent.clientX,
                e.originalEvent.clientY
            );
        });

        polygon.on('mouseout', (e: any) => {
            if (selectionMode !== 'edit' || mapStore.activeLayerId !== BUTTON_ID) {
                return;
            }

            setFeatureCursor((e.target as any)?._path ?? null, null);
            setMouseMarkerCursor('grab');
        });

        (polygon as any)['properties'] = { label, historyId };
        (polygon as any)['historyFeature'] = getPolygonHistoryFeature(polygon);

        const tooltip = polygon.bindTooltip(label, { permanent: true, direction: 'center' });
        syncTooltipVisibility(polygon);

        // Leaflet can re-open permanent tooltips when the parent layer is attached to the map.
        // Re-apply zoom/label gating at add-time so load-time visibility is always correct.
        polygon.on('add', () => {
            syncTooltipVisibility(polygon);
        });

        const popup = createLtnPopup(polygon, tooltip, label);

        polygon.on('click', (e: any) => {
            // Let the currently active tool own the click instead of forcing
            // LTN edit mode underneath it.
            if (mapStore.activeLayerId !== null && mapStore.activeLayerId !== BUTTON_ID) {
                return;
            }

            L.DomEvent.stopPropagation(e.originalEvent ?? e);

            const isModifierClick =
                (e.originalEvent?.shiftKey ||
                    e.originalEvent?.ctrlKey ||
                    e.originalEvent?.metaKey) ??
                false;

            if (isModifierClick) {
                // Additive selection: merge this polygon into the current
                // selection without opening the popup or entering edit mode.
                selectFeature(polygon as unknown as L.Layer, 'LtnCells', true);
                return;
            }

            // Non-modifier click: remember and highlight this polygon so that
            // a subsequent Shift/Ctrl-click can merge with it additively.
            const selectionStore = useSelectionStore(pinia);
            if (!selectionStore.isActive || selectionStore.selected.length === 0) {
                selectFeature(polygon as unknown as L.Layer, 'LtnCells', false, true);
            }

            // Disable editing on all other polygons in this layer first.
            geoJsonLayer.eachLayer((l: any) => {
                if (l !== e.target) {
                    l.editing?.disable();
                }
            });
            map.closePopup();
            // Switch to this layer for editing (deselects any active point/polyline layer).
            selectForEdit();
            removeMapCursor(CURSOR_CSS);
            syncPolygonEditCursor(
                (e.target as any)?._path ?? null,
                e.originalEvent.clientX,
                e.originalEvent.clientY
            );
            e.target.editing.enable();
            popup.setLatLng(e.target.getBounds().getCenter());
            map.openPopup(popup);
        });

        geoJsonLayer.addLayer(polygon);

        return polygon;
    };

    // ── Popup with label editor + copy + delete buttons ──────────────────────
    const createLtnPopup = (polygon: any, tooltip: any, initialLabel: string): L.Popup => {
        const popup = L.popup({ minWidth: 30, keepInView: true });
        const controlList = document.createElement('ul');
        controlList.classList.add('popup-buttons');

        const labelControl = document.createElement('li');
        const labelEl = document.createElement('input');
        labelEl.type = 'text';
        labelEl.value = initialLabel;
        labelEl.classList.add('label-editor');
        labelEl.addEventListener('keyup', () => {
            const text = labelEl.value;
            tooltip.setTooltipContent(text);
            polygon['properties'].label = text;
            syncTooltipVisibility(polygon);
            const previousFeature =
                (polygon as any)['historyFeature'] ?? getPolygonHistoryFeature(polygon);
            const nextFeature = getPolygonHistoryFeature(polygon);
            mapStore.markLayerUpdated({
                kind: 'polygon-edit',
                layerId: 'LtnCells',
                payload: getPolygonMutationPayload(previousFeature, nextFeature)
            });
            (polygon as any)['historyFeature'] = nextFeature;
        });
        labelControl.appendChild(labelEl);
        controlList.appendChild(labelControl);

        const copyControl = buildPopupActionControl('copy-button', 'Copy selected feature', () => {
            map.closePopup(popup);
            selectFeature(polygon as unknown as L.Layer, 'LtnCells', false);
            executeCopy();
        });
        controlList.appendChild(copyControl);

        const deleteControl = buildPopupActionControl(
            'delete-button',
            'Delete selected feature',
            () => {
                geoJsonLayer.removeLayer(polygon);
                mapStore.markLayerUpdated({
                    kind: 'polygon-delete',
                    layerId: 'LtnCells',
                    payload: {
                        before:
                            (polygon as any)['historyFeature'] ?? getPolygonHistoryFeature(polygon)
                    }
                });
                map.closePopup(popup);
            }
        );
        controlList.appendChild(deleteControl);

        popup.setContent(controlList);
        return popup;
    };

    // ── draw:created handler ─────────────────────────────────────────────────
    const handleDrawCreated = (e: any) => {
        if (!_selected) {
            return;
        }
        const latLngs = e.layer.getLatLngs()[0]; // polygon outer ring
        const polygon = addLtnCell(latLngs, _ltnTitle, COLOUR) as any;
        mapStore.markLayerUpdated({
            kind: 'polygon-add',
            layerId: 'LtnCells',
            payload: polygon?.historyFeature ?? e.layer.toGeoJSON?.() ?? null
        });
    };

    const disableDrawMode = () => {
        _drawingTool?.disable();
        _drawingTool = null;
        map.off('draw:created', handleDrawCreated);
    };

    // ── Zoom-based tooltip visibility ────────────────────────────────────────
    map.on('zoomend', () => {
        geoJsonLayer.eachLayer((l: any) => {
            syncTooltipVisibility(l);
        });
    });

    // ── Sync watch for selection state ───────────────────────────────────────
    watch(
        () => mapStore.activeLayerId,
        (newId) => {
            const shouldBeSelected = newId === BUTTON_ID;
            if (shouldBeSelected && !_selected) {
                _selected = true;
                setMapCursor(CURSOR_CSS);
                map.on('mousemove', syncMouseMarkerCursor as L.LeafletEventHandlerFn);
                if (selectionMode === 'draw') {
                    _drawingTool = new L.Draw.Polygon(map, { color: COLOUR });
                    _drawingTool.enable();
                    map.on('draw:created', handleDrawCreated);
                }
            } else if (!shouldBeSelected && _selected) {
                _selected = false;
                disableDrawMode();
                geoJsonLayer.eachLayer((l: any) => l.editing?.disable());
                map.off('mousemove', syncMouseMarkerCursor as L.LeafletEventHandlerFn);
                if (cursorSyncFrameId !== null) {
                    cancelAnimationFrame(cursorSyncFrameId);
                    cursorSyncFrameId = null;
                }
                pendingCursorEvent = null;
                setFeatureCursor(null, null);
                setMouseMarkerCursor(null);
                removeMapCursor(CURSOR_CSS);
                selectionMode = 'draw';
            }
        },
        { flush: 'sync' }
    );

    const action = (_e: Event, _m: L.Map): void => {
        selectionMode = 'draw';
    };

    /** Switch to this layer for editing an existing polygon without enabling draw mode. */
    const selectForEdit = (): void => {
        selectionMode = 'edit';
        if (_selected) {
            disableDrawMode();
        }
        mapStore.setActiveLayer(BUTTON_ID);
    };

    const visibilityProxy = {
        get visible() {
            return _visible;
        },
        set visible(v: boolean) {
            _visible = v;
        }
    };

    return {
        id: 'LtnCells',
        title: 'LTN Cells',
        groupName: '',
        kind: 'polygon' as const,
        get selected() {
            return _selected;
        },
        set selected(v: boolean) {
            _selected = v;
        },
        get visible() {
            return _visible;
        },
        set visible(v: boolean) {
            _visible = v;
        },
        iconHtml: (() => {
            const i = document.createElement('i');
            i.style.backgroundColor = COLOUR;
            return i.outerHTML;
        })(),

        getToolbarButton() {
            return buildToolbarButton({
                id: BUTTON_ID,
                tooltip: 'Add LTNs to the map',
                groupName: '',
                action,
                selected: _selected,
                text: 'LTN'
            });
        },

        getLegendEntry() {
            const icon = document.createElement('i');
            icon.style.backgroundColor = COLOUR;
            return buildLegendEntry({
                layerId: 'LtnCells',
                title: 'LTN Cells',
                toggleTitle: 'Toggle LTNs from the map',
                iconEl: icon,
                visibilityState: visibilityProxy
            });
        },

        loadFromGeoJSON(geoJson: any): void {
            if (!geoJson?.features) {
                return;
            }
            geoJson.features.forEach((feature: any) => {
                const points: L.LatLng[] = [];
                const polygonCoords = feature.geometry.coordinates[0];
                polygonCoords.forEach((c: number[]) => points.push(new L.LatLng(c[1], c[0])));
                const { label, color, historyId } = feature.properties ?? {};
                addLtnCell(
                    points,
                    label ?? '1',
                    color ?? COLOUR,
                    historyId ?? buildHistoryId('ltn')
                );
            });
        },

        getLayer(): L.GeoJSON {
            return geoJsonLayer;
        },

        toGeoJSON(): object {
            const json: any = { type: 'FeatureCollection', features: [] };
            geoJsonLayer.eachLayer((l: any) => {
                const feature = getPolygonHistoryFeature(l as any);
                json.features.push(feature);
            });
            return json;
        },

        clearLayer(): void {
            geoJsonLayer.clearLayers();
            _visible = false;
        },

        selectForEdit
    };
}
