import * as L from 'leaflet';
import { watch } from 'vue';
import { useMapStore } from '../../stores/mapStore';
import { pinia } from '../../stores/index';
import {
    setMapCursor,
    removeMapCursor,
    buildToolbarButton,
    buildLegendEntry,
    setMouseMarkerCursor,
    buildHistoryId,
    buildFeatureDescriptionPopup,
    buildReadOnlyGroupPopup,
    findFirstFeatureGroupId,
    getReadOnlyGroupCenter,
    addFeatureHoverPopup,
    getFeatureHoverLatLng,
    isFeatureEditLayerButtonId,
    closeFeatureHoverPopups,
    createFeatureHoverPopupController,
    setFeatureElementCursor,
    cacheFeatureGroupElement
} from './layerUtils';
import type { IMapLayer } from './IMapLayer';
import { type EditablePolylineLayer } from './usePolylineLayer';
import { selectFeature, executeCopy } from '../useAreaSelection';
import { useSelectionStore } from '../../stores/selectionStore';
import { useGroupStore } from '../../stores/groupStore';
import { openGroupDetails, recomputeFeatureVisibility } from '../useGroups';
import { useSettingsStore } from '../../stores/settingsStore';
import {
    getPolygonHistoryFeature as buildPolygonHistoryFeature,
    getPolygonMutationPayload as buildPolygonMutationPayload
} from './ltn/ltnPolygonGeometry';
import {
    syncMouseMarkerCursor as syncMouseMarkerCursorHelper,
    setFeatureCursor as setFeatureCursorHelper,
    syncPolygonEditCursor as syncPolygonEditCursorHelper,
    type CursorState,
    type MouseMarkerCursorSyncState
} from './ltn/ltnHoverCursor';
import {
    syncTooltipVisibility as syncTooltipVisibilityHelper,
    syncPolygonTooltip as syncPolygonTooltipHelper
} from './ltn/ltnTooltip';
import { createLtnPopup } from './ltn/ltnPopup';

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
    /**
     * Popup opened automatically after drawing a cell so the user can name it.
     * Tracked so it can be closed when the naming context ends (the layer is
     * deactivated, or the just-drawn cell is removed by undo/delete).
     */
    let _drawPopup: L.Popup | null = null;
    let selectionMode: 'draw' | 'edit' = 'draw';
    let editablePolygon: any = null;
    const cursorState: CursorState = { lastCursorStyledElement: null };
    const cursorSyncState: MouseMarkerCursorSyncState = {
        pendingCursorEvent: null,
        cursorSyncFrameId: null
    };

    const enableDrawMode = (): void => {
        _drawingTool = new L.Draw.Polygon(map, { color: COLOUR });
        _drawingTool.enable();
        map.on('draw:created', handleDrawCreated);
    };

    const getPolygonHistoryFeature = (polygon: any) => buildPolygonHistoryFeature(polygon, COLOUR);

    const getPolygonMutationPayload = (beforeFeature: any, afterFeature: any) =>
        buildPolygonMutationPayload(beforeFeature, afterFeature, COLOUR);

    const syncTooltipVisibility = (polygon: any): void => syncTooltipVisibilityHelper(map, polygon);

    const syncPolygonTooltip = (polygon: any, label?: string): void =>
        syncPolygonTooltipHelper(map, polygon, label);

    const setFeatureCursor = (element: Element | null, cursor: string | null): void =>
        setFeatureCursorHelper(cursorState, element, cursor);

    const syncPolygonEditCursor = (
        polygonElement: Element | null,
        clientX: number,
        clientY: number
    ): void =>
        syncPolygonEditCursorHelper(
            polygonElement,
            clientX,
            clientY,
            cursorState,
            selectionMode,
            mapStore.activeLayerId === BUTTON_ID,
            setMouseMarkerCursor
        );

    const syncMouseMarkerCursor = (event: L.LeafletMouseEvent): void =>
        syncMouseMarkerCursorHelper(event, cursorSyncState, cursorState, selectionMode, CURSOR_CSS);

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
            mapStore.markLayerUpdated({
                kind: 'polygon-edit',
                layerId: 'LtnCells',
                payload: getPolygonMutationPayload(previousFeature, nextFeature)
            });
            (polygon as any)['historyFeature'] = nextFeature;
        });

        polygon.on('mousedown', () => {
            if (
                mapStore.activeLayerId !== null &&
                mapStore.activeLayerId !== BUTTON_ID &&
                _drawingTool !== null &&
                mapStore.drawLayerId === BUTTON_ID
            ) {
                disableDrawMode();
            }
        });

        polygon.on('mousemove', (e: any) => {
            syncPolygonEditCursor(
                (e.target as any)?._path ?? null,
                e.originalEvent.clientX,
                e.originalEvent.clientY
            );
        });

        const hoverPopupController = createFeatureHoverPopupController();

        polygon.on('mouseover', (event: L.LeafletMouseEvent) => {
            if (map.hasLayer(popup)) {
                return;
            }

            closeFeatureHoverPopups(map);

            const groupId = findFirstFeatureGroupId({ layerId: 'LtnCells', historyId });
            cacheFeatureGroupElement(event.originalEvent.target as Element | null, groupId);
            if (groupId) {
                if (useSettingsStore(pinia).readOnly) {
                    setFeatureElementCursor(polygon, 'pointer');
                    const groupPopup = buildReadOnlyGroupPopup(groupId, openGroupDetails);
                    if (groupPopup) {
                        const groupCenter =
                            getReadOnlyGroupCenter(groupId) ?? polygon.getBounds().getCenter();
                        hoverPopupController.set(groupPopup);
                        addFeatureHoverPopup(
                            map,
                            groupPopup,
                            getFeatureHoverLatLng(map, groupCenter, event.latlng),
                            () => hoverPopupController.close(groupPopup)
                        );
                    }
                    return;
                }
            } else {
                if (useSettingsStore(pinia).readOnly) {
                    setFeatureElementCursor(polygon, 'default');
                }
                return;
            }

            const descriptionPopup = buildFeatureDescriptionPopup(
                { minWidth: 30, keepInView: true },
                { layerId: 'LtnCells', historyId },
                'hover',
                {
                    featureName: polygon.properties.label ?? '',
                    text: 'LTN',
                    onOpenGroup: openGroupDetails
                }
            );
            if (descriptionPopup) {
                const featureCenter = polygon.getBounds().getCenter();
                hoverPopupController.set(descriptionPopup);
                addFeatureHoverPopup(
                    map,
                    descriptionPopup,
                    getFeatureHoverLatLng(map, featureCenter, event.latlng),
                    () => hoverPopupController.close(descriptionPopup)
                );
            }
        });

        polygon.on('mouseout', (e: any) => {
            setFeatureElementCursor(polygon, null);
            hoverPopupController.scheduleClose();

            if (selectionMode !== 'edit' || mapStore.activeLayerId !== BUTTON_ID) {
                return;
            }

            setFeatureCursor((e.target as any)?._path ?? null, null);
            setMouseMarkerCursor('grab');
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

        const { popup, labelEl, colorEl, refreshGroupContent } = createLtnPopup(polygon, label, {
            map,
            geoJsonLayer,
            markLayerUpdated: (change) => mapStore.markLayerUpdated(change as any),
            defaultColour: COLOUR
        });
        // Expose the popup + label input on the polygon so the draw-created
        // handler can open it to prompt for a title immediately after drawing.
        (polygon as any).__ltnPopup = popup;
        (polygon as any).__ltnLabelEl = labelEl;

        polygon.on('click', (e: any) => {
            closeFeatureHoverPopups(map);
            if (useSettingsStore(pinia).readOnly) {
                L.DomEvent.stopPropagation(e.originalEvent ?? e);
                const groupId = findFirstFeatureGroupId({ layerId: 'LtnCells', historyId });
                if (groupId) {
                    openGroupDetails(groupId);
                    return;
                }
                const descriptionPopup = buildFeatureDescriptionPopup(
                    { minWidth: 30, keepInView: true },
                    { layerId: 'LtnCells', historyId },
                    'click',
                    {
                        featureName: polygon.properties.label ?? '',
                        text: 'LTN',
                        onOpenGroup: openGroupDetails
                    }
                );
                if (descriptionPopup) {
                    descriptionPopup.setLatLng(e.latlng ?? polygon.getBounds().getCenter());
                    map.openPopup(descriptionPopup);
                }
                return;
            }

            const isModifierClick =
                (e.originalEvent?.shiftKey ||
                    e.originalEvent?.ctrlKey ||
                    e.originalEvent?.metaKey) ??
                false;
            const selectionStore = useSelectionStore(pinia);
            const groupStore = useGroupStore(pinia);
            const isPhaseSelection = groupStore.phaseDraftActive;
            const isGroupEditing =
                selectionStore.isGroupSelection && selectionStore.selectedGroupId !== null;

            if (
                isPhaseSelection ||
                (isModifierClick && (selectionStore.isActive || selectionStore.isGroupSelection))
            ) {
                L.DomEvent.stopPropagation(e.originalEvent ?? e);
                if (isPhaseSelection) {
                    if (groupStore.phaseGroupId) {
                        selectionStore.markGroupSelection(groupStore.phaseGroupId);
                    }
                    selectionStore.setPhaseEditing(true);
                }
                selectFeature(
                    polygon as unknown as L.Layer,
                    'LtnCells',
                    true,
                    isPhaseSelection,
                    true
                );
                return;
            }

            if (isGroupEditing) {
                selectFeature(polygon as unknown as L.Layer, 'LtnCells', true, true, true);
                return;
            }

            // Let an explicitly armed draw tool own the click instead of
            // forcing LTN edit mode underneath it. Existing-feature edit mode
            // keeps drawLayerId=null, so cross-layer clicks can switch
            // selection.
            if (
                (mapStore.drawLayerId !== null && mapStore.activeLayerId !== BUTTON_ID) ||
                (mapStore.drawLayerId === null &&
                    mapStore.activeLayerId !== null &&
                    mapStore.activeLayerId !== BUTTON_ID &&
                    !isFeatureEditLayerButtonId(mapStore.activeLayerId))
            ) {
                return;
            }

            L.DomEvent.stopPropagation(e.originalEvent ?? e);

            if (isModifierClick) {
                // Additive selection: merge this polygon into the current
                // selection without opening the popup or entering edit mode.
                selectFeature(polygon as unknown as L.Layer, 'LtnCells', true, false, true);
                return;
            }

            // Non-modifier click: replace any previously remembered polygon
            // with this one so switching between polygons clears the old
            // selection immediately.
            selectFeature(polygon as unknown as L.Layer, 'LtnCells', false, true);

            if (editablePolygon && editablePolygon !== e.target) {
                editablePolygon.editing?.disable();
            }
            map.closePopup();
            // Switch to this layer for editing (deselects any active point/polyline layer).
            selectForEdit();
            removeMapCursor(CURSOR_CSS);
            labelEl.value = polygon.properties.label ?? '';
            colorEl.value = polygon.options.color ?? COLOUR;
            syncPolygonEditCursor(
                (e.target as any)?._path ?? null,
                e.originalEvent.clientX,
                e.originalEvent.clientY
            );
            e.target.editing.enable();
            editablePolygon = e.target;
            recomputeFeatureVisibility();
            popup.setLatLng(e.target.getBounds().getCenter());
            const focusPopupLabel = (event: L.PopupEvent): void => {
                if (event.popup !== popup) {
                    return;
                }

                map.off('popupopen', focusPopupLabel);
                labelEl.focus();
            };
            refreshGroupContent();
            map.on('popupopen', focusPopupLabel);
            map.openPopup(popup);
            labelEl.focus();
        });

        geoJsonLayer.addLayer(polygon);

        return polygon;
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
                labelEl?.focus();
                labelEl?.select();
            };
            map.on('popupopen', focusDrawPopupLabel);
            window.setTimeout(() => {
                if (!_selected || _drawPopup !== popup) {
                    map.off('popupopen', focusDrawPopupLabel);
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
        if (_drawPopup) {
            map.closePopup(_drawPopup);
            _drawPopup = null;
        }
    };

    // Close the naming popup if the cell it belongs to is removed (undo/delete).
    geoJsonLayer.on('layerremove', (e: any) => {
        if (e.layer === editablePolygon) {
            editablePolygon = null;
        }
        if (_drawPopup && e.layer?.__ltnPopup === _drawPopup) {
            closeDrawPopup();
        }
    });

    // Forget the naming popup once it closes for any reason (Enter, close
    // button, clicking away) so no stale reference is kept.
    map.on('popupclose', (e: L.PopupEvent) => {
        if (e.popup === _drawPopup) {
            _drawPopup = null;
        }
    });

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
                    enableDrawMode();
                }
            } else if (!shouldBeSelected && _selected) {
                _selected = false;
                disableDrawMode();
                closeDrawPopup();
                editablePolygon?.editing?.disable();
                editablePolygon = null;
                recomputeFeatureVisibility();
                map.off('mousemove', syncMouseMarkerCursor as L.LeafletEventHandlerFn);
                if (cursorSyncState.cursorSyncFrameId !== null) {
                    cancelAnimationFrame(cursorSyncState.cursorSyncFrameId);
                    cursorSyncState.cursorSyncFrameId = null;
                }
                cursorSyncState.pendingCursorEvent = null;
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

            if (_selected && selectionMode === 'draw' && mapStore.drawLayerId === BUTTON_ID) {
                disableDrawMode();
                enableDrawMode();
            }
        },

        loadFeature(feature: any, historyId?: string): string | null {
            if (feature?.geometry?.type !== 'Polygon') {
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

        selectForEdit
    };
}
