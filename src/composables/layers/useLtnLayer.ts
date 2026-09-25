import * as L from 'leaflet';
import { watch } from 'vue';
import { useMapStore } from '../../stores/mapStore';
import { pinia } from '../../stores/index';
import { buildToolbarButton } from './toolbarButton';
import { buildLegendEntry } from './legendEntry';
import { isPointFeatureElement } from './featureClassification';
import { buildHistoryId } from './featureLookup';
import { findFeatureGroupIdByElement } from './featureGroupMembershipPopup';
import type { IMapLayer } from './IMapLayer';
import { type EditablePolylineLayer } from './usePolylineLayer';
import {
    selectFeature,
    executeCopy,
    clearFeatureHighlight,
    applySelectionHighlights
} from '../useAreaSelection';
import { useSelectionStore } from '../../stores/selectionStore';
import {
    addFeatureToGroup,
    createGroupFromFeature,
    openGroupDetails,
    recomputeFeatureVisibility,
    removeFeatureFromGroup
} from '../useGroups';
import { useSettingsStore } from '../../stores/settingsStore';
import { isFeatureGroupHidden } from '../../features/groups/featureVisibility';
import { getPolygonMutationPayload } from './ltnPolygonMutation';
import { createLtnPopup } from './ltnPopup';
import { createLtnCursorController } from './ltnCursorController';
import { attachLtnPolygonInteractions } from './ltnPolygonInteractions';

const COLOUR = '#cc00cc';
const BUTTON_ID = 'ltn';

export function createLtnLayer(map: L.Map): EditablePolylineLayer {
    const mapStore = useMapStore(pinia);
    const geoJsonLayer = new L.GeoJSON(undefined, { pane: 'ltns' });
    let _selected = false;
    let _visible = false;
    let _drawingTool: any = null;
    let _ltnTitle = '1';
    /**
     * Popup opened automatically after drawing a cell so the user can name it.
     * Tracked so it can be closed when the naming context ends (the layer is
     * deactivated, or the just-drawn cell is removed by undo/delete).
     */
    let _drawPopup: L.Popup | null = null;
    let selectionMode: 'draw' | 'edit' = 'draw';
    let editablePolygon: any = null;
    let drawPopupTimeoutId: number | null = null;
    let removeDrawPopupFocusHandler: (() => void) | null = null;
    let _disposed = false;

    const enableDrawMode = (): void => {
        _drawingTool = new L.Draw.Polygon(map, { color: COLOUR });
        _drawingTool.enable();
        map.on('draw:created', handleDrawCreated);
    };

    const getPolygonHistoryFeature = (polygon: any) => {
        const feature = polygon.toGeoJSON() as any;
        feature.properties = feature.properties ?? {};
        feature.properties.label = polygon['properties']?.label ?? '';
        feature.properties.color = polygon.options?.color ?? COLOUR;
        feature.properties.historyId = polygon['properties']?.historyId ?? '';
        return feature;
    };

    const recordPolygonEdit = (beforeFeature: any, afterFeature: any): void => {
        mapStore.markLayerUpdated({
            kind: 'polygon-edit',
            layerId: 'LtnCells',
            payload: getPolygonMutationPayload(beforeFeature, afterFeature, COLOUR)
        });
    };

    const ltnCursorController = createLtnCursorController(map, {
        getSelectionMode: () => selectionMode,
        isLayerActive: () => mapStore.activeLayerId === BUTTON_ID,
        isReadOnly: () => useSettingsStore(pinia).readOnly,
        isPointFeatureElement,
        isGroupedFeatureElement: (element) => findFeatureGroupIdByElement(element) !== null
    });

    const shouldShowLabel = (label: string): boolean => {
        return map.getZoom() >= 14 && label.length > 0;
    };

    const syncTooltipVisibility = (polygon: any): void => {
        const label = polygon['properties']?.label ?? '';
        if (!isFeatureGroupHidden(polygon) && shouldShowLabel(label)) {
            polygon.openTooltip?.();
        } else {
            polygon.closeTooltip?.();
        }
    };

    const syncPolygonTooltip = (polygon: any, label?: string): void => {
        const nextLabel = label ?? polygon['properties']?.label ?? '';
        polygon.setTooltipContent?.(nextLabel);
        polygon.getTooltip?.()?.setLatLng?.(polygon.getBounds().getCenter());
        syncTooltipVisibility(polygon);
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
            syncPolygonTooltip(polygon);
            const nextFeature = getPolygonHistoryFeature(polygon);
            recordPolygonEdit(previousFeature, nextFeature);
            (polygon as any)['historyFeature'] = nextFeature;
        });

        (polygon as any)['properties'] = { label, historyId };
        (polygon as any)['historyFeature'] = getPolygonHistoryFeature(polygon);

        polygon.bindTooltip(label, { permanent: true, direction: 'center' });
        (polygon as any).syncGroupVisibility = () => syncTooltipVisibility(polygon);
        (polygon as any).syncGroupStyle = () => recomputeFeatureVisibility();
        syncPolygonTooltip(polygon, label);

        // Leaflet can re-open permanent tooltips when the parent layer is attached to the map.
        // Re-apply zoom/label gating at add-time so load-time visibility is always correct.
        polygon.on('add', () => {
            syncTooltipVisibility(polygon);
        });

        const {
            popup,
            labelEl,
            colorEl,
            refreshGroupContent,
            dispose: disposePopup
        } = createLtnPopup(map, polygon, label, {
            defaultColor: COLOUR,
            getHistoryFeature: () => getPolygonHistoryFeature(polygon),
            onPolygonMutation: recordPolygonEdit,
            syncTooltip: (nextLabel) => syncPolygonTooltip(polygon, nextLabel),
            recomputeFeatureVisibility,
            onCopy: (popup) => {
                map.closePopup(popup);
                selectFeature(polygon as unknown as L.Layer, 'LtnCells', false);
                executeCopy();
            },
            onDelete: (popup) => {
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
                clearFeatureHighlight();
            },
            onOpenGroup: openGroupDetails,
            onRemoveFromGroup: (groupId) =>
                removeFeatureFromGroup(groupId, {
                    layerId: 'LtnCells',
                    historyId: polygon.properties.historyId
                }),
            onAddToGroup: (groupId) =>
                addFeatureToGroup(groupId, {
                    layerId: 'LtnCells',
                    historyId: polygon.properties.historyId
                }),
            onCreateNewGroup: createGroupFromFeature
        });
        // Expose the popup + label input on the polygon so the draw-created
        // handler can open it to prompt for a title immediately after drawing.
        (polygon as any).__ltnPopup = popup;
        (polygon as any).__ltnLabelEl = labelEl;
        attachLtnPolygonInteractions({
            map,
            polygon,
            historyId,
            popup,
            labelEl,
            colorEl,
            refreshGroupContent,
            disposePopup,
            recomputeFeatureVisibility,
            getSelectionMode: () => selectionMode,
            isDrawingToolEnabled: () => _drawingTool !== null,
            disableDrawMode,
            getEditablePolygon: () => editablePolygon,
            setEditablePolygon: (nextPolygon) => {
                editablePolygon = nextPolygon;
            },
            selectForEdit,
            cursorController: ltnCursorController,
            defaultColor: COLOUR
        });

        geoJsonLayer.addLayer(polygon);

        return polygon;
    };

    // ── draw:created handler ─────────────────────────────────────────────────
    const handleDrawCreated = (e: any) => {
        if (_disposed || !_selected) {
            return;
        }
        const latLngs = e.layer.getLatLngs()[0]; // polygon outer ring
        const polygon = addLtnCell(latLngs, _ltnTitle, COLOUR) as any;
        mapStore.markLayerUpdated({
            kind: 'polygon-add',
            layerId: 'LtnCells',
            payload: polygon?.historyFeature ?? e.layer.toGeoJSON?.() ?? null
        });

        // Prompt for the cell's title immediately: open its popup with the
        // label input focused. Draw mode stays active so more cells can be
        // drawn after naming this one (pressing Enter closes the popup).
        const popup = polygon?.__ltnPopup as L.Popup | undefined;
        const labelEl = polygon?.__ltnLabelEl as HTMLInputElement | undefined;
        if (popup) {
            popup.setLatLng(polygon.getBounds().getCenter());
            _drawPopup = popup;
            const focusDrawPopupLabel = (event: L.PopupEvent): void => {
                if (event.popup !== popup) {
                    return;
                }

                map.off('popupopen', focusDrawPopupLabel);
                removeDrawPopupFocusHandler = null;
                labelEl?.focus();
                labelEl?.select();
            };
            removeDrawPopupFocusHandler = () => {
                map.off('popupopen', focusDrawPopupLabel);
                removeDrawPopupFocusHandler = null;
            };
            map.on('popupopen', focusDrawPopupLabel);
            drawPopupTimeoutId = window.setTimeout(() => {
                drawPopupTimeoutId = null;
                if (_disposed || !_selected || _drawPopup !== popup) {
                    removeDrawPopupFocusHandler?.();
                    return;
                }

                map.openPopup(popup);
                labelEl?.focus();
                labelEl?.select();
            }, 0);
        }
    };

    const disableDrawMode = () => {
        _drawingTool?.disable();
        _drawingTool = null;
        map.off('draw:created', handleDrawCreated);
    };

    /** Close the auto-opened "name this cell" popup, if one is showing. */
    const closeDrawPopup = () => {
        if (drawPopupTimeoutId !== null) {
            window.clearTimeout(drawPopupTimeoutId);
            drawPopupTimeoutId = null;
        }
        removeDrawPopupFocusHandler?.();
        if (_drawPopup) {
            map.closePopup(_drawPopup);
            _drawPopup = null;
        }
    };

    // Close the naming popup if the cell it belongs to is removed (undo/delete).
    const handleLayerRemove = (e: any) => {
        e.layer?.editing?.disable?.();
        if (e.layer === editablePolygon) {
            editablePolygon = null;
        }
        if (_drawPopup && e.layer?.__ltnPopup === _drawPopup) {
            closeDrawPopup();
        }
        e.layer?.__disposeLtnPopup?.();
        e.layer?.__disposeLtnHoverPopup?.();
        e.layer?.off?.();
    };
    geoJsonLayer.on('layerremove', handleLayerRemove);

    // Forget the naming popup once it closes for any reason (Enter, close
    // button, clicking away) so no stale reference is kept.
    const handlePopupClose = (e: L.PopupEvent) => {
        if (e.popup === _drawPopup) {
            _drawPopup = null;
        }
    };
    map.on('popupclose', handlePopupClose);

    // ── Zoom-based tooltip visibility ────────────────────────────────────────
    const handleZoomEnd = () => {
        geoJsonLayer.eachLayer((l: any) => {
            syncTooltipVisibility(l);
        });
    };
    map.on('zoomend', handleZoomEnd);

    // ── Sync watch for selection state ───────────────────────────────────────
    const stopActiveLayerWatch = watch(
        () => mapStore.activeLayerId,
        (newId) => {
            const shouldBeSelected = newId === BUTTON_ID;
            if (shouldBeSelected && !_selected) {
                _selected = true;
                ltnCursorController.start();
                if (selectionMode === 'draw') {
                    enableDrawMode();
                }
            } else if (!shouldBeSelected && _selected) {
                _selected = false;
                disableDrawMode();
                closeDrawPopup();
                editablePolygon?.editing?.disable();
                editablePolygon = null;
                recomputeFeatureVisibility();
                ltnCursorController.stop();
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

    const dispose = (): void => {
        if (_disposed) {
            return;
        }
        _disposed = true;
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
        disableDrawMode();
        closeDrawPopup();
        editablePolygon?.editing?.disable();
        editablePolygon = null;
        recomputeFeatureVisibility();
        map.off('popupclose', handlePopupClose);
        map.off('zoomend', handleZoomEnd);
        geoJsonLayer.off('layerremove', handleLayerRemove);
        geoJsonLayer.eachLayer((layer: any) => layer.__disposeLtnPopup?.());
        geoJsonLayer.eachLayer((layer: any) => layer.__disposeLtnHoverPopup?.());
        geoJsonLayer.eachLayer((layer: any) => layer.off?.());
        map.removeLayer(geoJsonLayer);
        geoJsonLayer.clearLayers();
        ltnCursorController.stop();
        _selected = false;
        selectionMode = 'draw';
        _visible = false;
        if (mapStore.activeLayerId === BUTTON_ID) {
            mapStore.setActiveLayer(null);
        }
        if (mapStore.drawLayerId === BUTTON_ID) {
            mapStore.setDrawLayer(null);
        }
        mapStore.visibleLayerIds = new Set(
            [...mapStore.visibleLayerIds].filter((id) => id !== 'LtnCells')
        );
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
            const icon = document.createElement('i');
            icon.style.backgroundColor = COLOUR;
            return icon.outerHTML;
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
            if (_disposed || !geoJson?.features) {
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

            if (_selected && selectionMode === 'draw' && mapStore.drawLayerId === BUTTON_ID) {
                disableDrawMode();
                enableDrawMode();
            }
        },

        loadFeature(feature: any, historyId?: string): string | null {
            if (_disposed || feature?.geometry?.type !== 'Polygon') {
                return null;
            }
            const points = (feature.geometry.coordinates[0] ?? []).map(
                ([lng, lat]: [number, number]) => new L.LatLng(lat, lng)
            );
            const properties = feature.properties ?? {};
            const id = historyId ?? buildHistoryId('ltn');
            addLtnCell(points, properties.label ?? '1', properties.color ?? COLOUR, id);
            return id;
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

        dispose,

        selectForEdit
    };
}
