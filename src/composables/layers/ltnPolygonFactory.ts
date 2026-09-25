import * as L from 'leaflet';
import { pinia } from '../../stores/index';
import { useMapStore } from '../../stores/mapStore';
import { selectFeature, executeCopy, clearFeatureHighlight } from '../useAreaSelection';
import {
    addFeatureToGroup,
    createGroupFromFeature,
    openGroupDetails,
    recomputeFeatureVisibility,
    removeFeatureFromGroup
} from '../useGroups';
import { isFeatureGroupHidden } from '../../features/groups/featureVisibility';
import { buildHistoryId } from './featureLookup';
import { getPolygonMutationPayload } from './ltnPolygonMutation';
import { createLtnPopup } from './ltnPopup';
import { attachLtnPolygonInteractions } from './ltnPolygonInteractions';
import type { createLtnCursorController } from './ltnCursorController';

interface LtnPolygonFactoryOptions {
    map: L.Map;
    geoJsonLayer: L.GeoJSON;
    defaultColor: string;
    getSelectionMode: () => 'draw' | 'edit';
    isDrawingToolEnabled: () => boolean;
    disableDrawMode: () => void;
    getEditablePolygon: () => any;
    setEditablePolygon: (polygon: any | null) => void;
    selectForEdit: () => void;
    cursorController: ReturnType<typeof createLtnCursorController>;
}

export function createLtnPolygonFactory(options: LtnPolygonFactoryOptions) {
    const {
        map,
        geoJsonLayer,
        defaultColor,
        getSelectionMode,
        isDrawingToolEnabled,
        disableDrawMode,
        getEditablePolygon,
        setEditablePolygon,
        selectForEdit,
        cursorController
    } = options;
    const mapStore = useMapStore(pinia);

    const getPolygonHistoryFeature = (polygon: any) => {
        const feature = polygon.toGeoJSON() as any;
        feature.properties = feature.properties ?? {};
        feature.properties.label = polygon['properties']?.label ?? '';
        feature.properties.color = polygon.options?.color ?? defaultColor;
        feature.properties.historyId = polygon['properties']?.historyId ?? '';
        return feature;
    };

    const recordPolygonEdit = (beforeFeature: any, afterFeature: any): void => {
        mapStore.markLayerUpdated({
            kind: 'polygon-edit',
            layerId: 'LtnCells',
            payload: getPolygonMutationPayload(beforeFeature, afterFeature, defaultColor)
        });
    };

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

    const addLtnCell = (
        points: L.LatLng[],
        label: string,
        color: string,
        historyId = buildHistoryId('ltn')
    ) => {
        const polygon = new L.Polygon(points, {
            color: color || defaultColor,
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
            defaultColor,
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
                removeFeatureFromGroup(groupId, { layerId: 'LtnCells', historyId }),
            onAddToGroup: (groupId) =>
                addFeatureToGroup(groupId, { layerId: 'LtnCells', historyId }),
            onCreateNewGroup: createGroupFromFeature
        });

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
            getSelectionMode,
            isDrawingToolEnabled,
            disableDrawMode,
            getEditablePolygon,
            setEditablePolygon,
            selectForEdit,
            cursorController,
            defaultColor
        });

        geoJsonLayer.addLayer(polygon);
        return polygon;
    };

    return { addLtnCell, getPolygonHistoryFeature, syncTooltipVisibility };
}
