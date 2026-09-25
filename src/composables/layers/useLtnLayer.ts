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
import { applySelectionHighlights } from '../useAreaSelection';
import { useSelectionStore } from '../../stores/selectionStore';
import { recomputeFeatureVisibility } from '../useGroups';
import { useSettingsStore } from '../../stores/settingsStore';
import { createLtnCursorController } from './ltnCursorController';
import { createLtnDrawController } from './ltnDrawController';
import { createLtnPolygonFactory } from './ltnPolygonFactory';

const COLOUR = '#cc00cc';
const BUTTON_ID = 'ltn';

export function createLtnLayer(map: L.Map): EditablePolylineLayer {
    const mapStore = useMapStore(pinia);
    const geoJsonLayer = new L.GeoJSON(undefined, { pane: 'ltns' });
    let _selected = false;
    let _visible = false;
    let _ltnTitle = '1';
    let selectionMode: 'draw' | 'edit' = 'draw';
    let editablePolygon: any = null;
    let _disposed = false;

    const ltnCursorController = createLtnCursorController(map, {
        getSelectionMode: () => selectionMode,
        isLayerActive: () => mapStore.activeLayerId === BUTTON_ID,
        isReadOnly: () => useSettingsStore(pinia).readOnly,
        isPointFeatureElement,
        isGroupedFeatureElement: (element) => findFeatureGroupIdByElement(element) !== null
    });

    const { addLtnCell, getPolygonHistoryFeature, syncTooltipVisibility } = createLtnPolygonFactory(
        {
            map,
            geoJsonLayer,
            defaultColor: COLOUR,
            getSelectionMode: () => selectionMode,
            isDrawingToolEnabled: () => ltnDrawController.isEnabled(),
            disableDrawMode: () => ltnDrawController.disable(),
            getEditablePolygon: () => editablePolygon,
            setEditablePolygon: (nextPolygon) => {
                editablePolygon = nextPolygon;
            },
            selectForEdit: () => selectForEdit(),
            cursorController: ltnCursorController
        }
    );

    const ltnDrawController = createLtnDrawController({
        map,
        color: COLOUR,
        isSelected: () => _selected,
        isDisposed: () => _disposed,
        onDrawCreated: (layer) => {
            const polygon = addLtnCell(layer.getLatLngs()[0], _ltnTitle, COLOUR) as any;
            mapStore.markLayerUpdated({
                kind: 'polygon-add',
                layerId: 'LtnCells',
                payload: polygon?.historyFeature ?? layer.toGeoJSON?.() ?? null
            });
            return polygon;
        }
    });

    // Close the naming popup if the cell it belongs to is removed (undo/delete).
    const handleLayerRemove = (e: any) => {
        e.layer?.editing?.disable?.();
        if (e.layer === editablePolygon) {
            editablePolygon = null;
        }
        ltnDrawController.handleLayerRemoved(e.layer);
        e.layer?.__disposeLtnPopup?.();
        e.layer?.__disposeLtnHoverPopup?.();
        e.layer?.off?.();
    };
    geoJsonLayer.on('layerremove', handleLayerRemove);

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
                    ltnDrawController.enable();
                }
            } else if (!shouldBeSelected && _selected) {
                _selected = false;
                ltnDrawController.disable();
                ltnDrawController.closeNamingPopup();
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
            ltnDrawController.disable();
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
        ltnDrawController.dispose();
        editablePolygon?.editing?.disable();
        editablePolygon = null;
        recomputeFeatureVisibility();
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
                ltnDrawController.disable();
                ltnDrawController.enable();
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
