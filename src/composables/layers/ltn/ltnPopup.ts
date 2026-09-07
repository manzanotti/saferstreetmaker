// ── LTN popup (label editor + copy + delete buttons) ─────────────────────
// Extracted from useLtnLayer.ts.

import * as L from 'leaflet';
import { buildPopupActionControl, buildFeatureGroupMembershipContent } from '../layerUtils';
import { selectFeature, executeCopy, clearFeatureHighlight } from '../../useAreaSelection';
import {
    addFeatureToGroup,
    createGroupFromFeature,
    openGroupDetails,
    recomputeFeatureVisibility,
    removeFeatureFromGroup
} from '../../useGroups';
import { getPolygonHistoryFeature, getPolygonMutationPayload } from './ltnPolygonGeometry';
import { syncPolygonTooltip } from './ltnTooltip';

export interface LtnPopupDeps {
    map: L.Map;
    geoJsonLayer: L.GeoJSON;
    markLayerUpdated: (change: { kind: string; layerId: string; payload: unknown }) => void;
    defaultColour: string;
}

export const createLtnPopup = (
    polygon: any,
    initialLabel: string,
    deps: LtnPopupDeps
): {
    popup: L.Popup;
    labelEl: HTMLInputElement;
    colorEl: HTMLInputElement;
    refreshGroupContent: () => void;
} => {
    const { map, geoJsonLayer, markLayerUpdated, defaultColour } = deps;

    const popup = L.popup({
        minWidth: 30,
        keepInView: true,
        className: 'feature-popup-editor'
    });
    const controlList = document.createElement('ul');
    controlList.classList.add('popup-buttons', 'ltn-popup-buttons');
    const currentControls = document.createElement('li');
    currentControls.classList.add('current-controls');
    const currentControlsContent = document.createElement('ul');
    currentControlsContent.classList.add('current-controls-content');
    currentControls.appendChild(currentControlsContent);
    controlList.appendChild(currentControls);

    const labelControl = document.createElement('li');
    const labelEl = document.createElement('input');
    labelEl.type = 'text';
    labelEl.value = initialLabel;
    labelEl.classList.add('label-editor');
    labelControl.appendChild(labelEl);
    currentControlsContent.appendChild(labelControl);

    const colorControl = document.createElement('li');
    const colorEl = document.createElement('input');
    colorEl.type = 'color';
    colorEl.value = polygon.options.color ?? defaultColour;
    colorEl.classList.add('colour-swatch');
    colorEl.setAttribute('aria-label', 'Change cell colour');
    colorEl.title = 'Change cell colour';
    colorControl.appendChild(colorEl);
    currentControlsContent.appendChild(colorControl);

    const copyControl = buildPopupActionControl('copy-button', 'Copy selected feature', () => {
        map.closePopup(popup);
        selectFeature(polygon as unknown as L.Layer, 'LtnCells', false);
        executeCopy();
    });
    currentControlsContent.appendChild(copyControl);

    const deleteControl = buildPopupActionControl(
        'delete-button',
        'Delete selected feature',
        () => {
            flushMetadataChanges();
            geoJsonLayer.removeLayer(polygon);
            markLayerUpdated({
                kind: 'polygon-delete',
                layerId: 'LtnCells',
                payload: {
                    before:
                        (polygon as any)['historyFeature'] ??
                        getPolygonHistoryFeature(polygon, defaultColour)
                }
            });
            map.closePopup(popup);
            // Remove the selection vertex handles left from clicking the
            // polygon so they don't linger after it is deleted.
            clearFeatureHighlight();
        }
    );
    currentControlsContent.appendChild(deleteControl);

    let metadataBeforeFeature: any = null;

    const flushMetadataChanges = (): void => {
        if (!metadataBeforeFeature) {
            return;
        }

        const nextFeature = getPolygonHistoryFeature(polygon, defaultColour);
        markLayerUpdated({
            kind: 'polygon-edit',
            layerId: 'LtnCells',
            payload: getPolygonMutationPayload(metadataBeforeFeature, nextFeature, defaultColour)
        });
        metadataBeforeFeature = null;
    };

    const saveMetadataChanges = (): void => {
        const currentLabel = polygon['properties'].label ?? '';
        const currentColor = polygon.options.color ?? defaultColour;
        if (labelEl.value === currentLabel && colorEl.value === currentColor) {
            return;
        }

        const previousFeature =
            (polygon as any)['historyFeature'] ?? getPolygonHistoryFeature(polygon, defaultColour);
        metadataBeforeFeature ??= previousFeature;
        polygon['properties'].label = labelEl.value;
        syncPolygonTooltip(map, polygon, labelEl.value);
        polygon.setStyle({ color: colorEl.value });
        const nextFeature = getPolygonHistoryFeature(polygon, defaultColour);
        (polygon as any)['historyFeature'] = nextFeature;
        recomputeFeatureVisibility();
    };

    labelEl.addEventListener('input', saveMetadataChanges);
    colorEl.addEventListener('input', saveMetadataChanges);
    labelEl.addEventListener('change', flushMetadataChanges);
    colorEl.addEventListener('change', flushMetadataChanges);
    labelEl.addEventListener('keydown', (event: KeyboardEvent) => {
        if (event.key !== 'Enter') {
            return;
        }

        event.preventDefault();
        flushMetadataChanges();
        map.closePopup(popup);
    });

    const popupContent = document.createElement('div');
    popupContent.classList.add('feature-popup-content');
    const refreshGroupContent = () => {
        controlList.querySelectorAll('.feature-popup-group-content').forEach((groupContent) => {
            groupContent.remove();
        });
        const groupContentItem = document.createElement('li');
        groupContentItem.classList.add('feature-popup-group-content');
        groupContentItem.appendChild(
            buildFeatureGroupMembershipContent(
                { layerId: 'LtnCells', historyId: polygon.properties.historyId },
                openGroupDetails,
                (groupId) => {
                    flushMetadataChanges();
                    return removeFeatureFromGroup(groupId, {
                        layerId: 'LtnCells',
                        historyId: polygon.properties.historyId
                    });
                },
                (groupId) => {
                    flushMetadataChanges();
                    return addFeatureToGroup(groupId, {
                        layerId: 'LtnCells',
                        historyId: polygon.properties.historyId
                    });
                },
                (member, onCreated) => {
                    flushMetadataChanges();
                    createGroupFromFeature(member, onCreated);
                }
            )
        );
        controlList.appendChild(groupContentItem);
    };
    popupContent.appendChild(controlList);
    refreshGroupContent();
    popup.setContent(popupContent);
    return { popup, labelEl, colorEl, refreshGroupContent };
};
