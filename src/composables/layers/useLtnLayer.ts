import * as L from 'leaflet';
import { useMapStore } from '../../stores/mapStore';
import { pinia } from '../../stores/index';
import { buildToolbarButton } from './toolbarButton';
import { buildLegendEntry } from './legendEntry';
import { isPointFeatureElement } from './featureClassification';
import { buildHistoryId } from './featureLookup';
import { findFeatureGroupIdByElement } from './featureGroupMembershipPopup';
import type { IMapLayer } from './IMapLayer';
import { type EditablePolylineLayer } from './usePolylineLayer';
import { useSettingsStore } from '../../stores/settingsStore';
import { createLtnCursorController } from './ltnCursorController';
import { createLtnDrawController } from './ltnDrawController';
import { createLtnPolygonFactory } from './ltnPolygonFactory';
import { createLtnLayerLifecycle, type LtnLayerState } from './ltnLayerLifecycle';

const COLOUR = '#cc00cc';
const BUTTON_ID = 'ltn';

export function createLtnLayer(map: L.Map): EditablePolylineLayer {
    const mapStore = useMapStore(pinia);
    const geoJsonLayer = new L.GeoJSON(undefined, { pane: 'ltns' });
    const state: LtnLayerState = {
        selected: false,
        visible: false,
        selectionMode: 'draw',
        editablePolygon: null,
        disposed: false
    };
    let _ltnTitle = '1';

    const ltnCursorController = createLtnCursorController(map, {
        getSelectionMode: () => state.selectionMode,
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
            getSelectionMode: () => state.selectionMode,
            isDrawingToolEnabled: () => ltnDrawController.isEnabled(),
            disableDrawMode: () => ltnDrawController.disable(),
            getEditablePolygon: () => state.editablePolygon,
            setEditablePolygon: (nextPolygon) => {
                state.editablePolygon = nextPolygon;
            },
            selectForEdit: () => selectForEdit(),
            cursorController: ltnCursorController
        }
    );

    const ltnDrawController = createLtnDrawController({
        map,
        color: COLOUR,
        isSelected: () => state.selected,
        isDisposed: () => state.disposed,
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

    const lifecycle = createLtnLayerLifecycle({
        map,
        geoJsonLayer,
        buttonId: BUTTON_ID,
        state,
        drawController: ltnDrawController,
        cursorController: ltnCursorController,
        syncTooltipVisibility
    });

    const action = (_e: Event, _m: L.Map): void => {
        state.selectionMode = 'draw';
    };

    /** Switch to this layer for editing an existing polygon without enabling draw mode. */
    const selectForEdit = (): void => {
        state.selectionMode = 'edit';
        if (state.selected) {
            ltnDrawController.disable();
        }
        mapStore.setActiveLayer(BUTTON_ID);
    };

    const visibilityProxy = {
        get visible() {
            return state.visible;
        },
        set visible(v: boolean) {
            state.visible = v;
        }
    };

    return {
        id: 'LtnCells',
        title: 'LTN Cells',
        groupName: '',
        kind: 'polygon' as const,
        get selected() {
            return state.selected;
        },
        set selected(v: boolean) {
            state.selected = v;
        },
        get visible() {
            return state.visible;
        },
        set visible(v: boolean) {
            state.visible = v;
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
                selected: state.selected,
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
            if (state.disposed || !geoJson?.features) {
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

            if (
                state.selected &&
                state.selectionMode === 'draw' &&
                mapStore.drawLayerId === BUTTON_ID
            ) {
                ltnDrawController.disable();
                ltnDrawController.enable();
            }
        },

        loadFeature(feature: any, historyId?: string): string | null {
            if (state.disposed || feature?.geometry?.type !== 'Polygon') {
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
            state.visible = false;
        },

        dispose: lifecycle.dispose,

        selectForEdit
    };
}
