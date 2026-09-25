import * as L from 'leaflet';
import { pinia } from '../../stores/index';
import { useGroupStore } from '../../stores/groupStore';
import { useMapStore } from '../../stores/mapStore';
import { useSelectionStore } from '../../stores/selectionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { selectFeature } from '../useAreaSelection';
import { openGroupDetails } from '../useGroups';
import { isFeatureEditLayerButtonId } from './featureClassification';
import { buildFeatureDescriptionPopup } from './featureDescriptionPopup';
import { closeFeatureHoverPopups } from './featureHoverPopups';
import { findFirstFeatureGroupId } from './featureGroupMembershipPopup';
import type { createLtnCursorController } from './ltnCursorController';

const BUTTON_ID = 'ltn';
const LAYER_ID = 'LtnCells';

interface LtnPolygonClickHandlerOptions {
    map: L.Map;
    polygon: any;
    historyId: string;
    popup: L.Popup;
    labelEl: HTMLInputElement;
    colorEl: HTMLInputElement;
    refreshGroupContent: () => void;
    recomputeFeatureVisibility: () => void;
    getEditablePolygon: () => any;
    setEditablePolygon: (polygon: any | null) => void;
    selectForEdit: () => void;
    cursorController: ReturnType<typeof createLtnCursorController>;
    defaultColor: string;
}

export function attachLtnPolygonClickHandler(options: LtnPolygonClickHandlerOptions): () => void {
    const {
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
    } = options;
    const mapStore = useMapStore(pinia);
    let removePopupFocusHandler: (() => void) | null = null;

    const handleClick = (event: any): void => {
        closeFeatureHoverPopups(map);
        if (useSettingsStore(pinia).readOnly) {
            L.DomEvent.stopPropagation(event.originalEvent ?? event);
            const groupId = findFirstFeatureGroupId({ layerId: LAYER_ID, historyId });
            if (groupId) {
                openGroupDetails(groupId);
                return;
            }
            const descriptionPopup = buildFeatureDescriptionPopup(
                { minWidth: 30, keepInView: true },
                { layerId: LAYER_ID, historyId },
                'click',
                {
                    featureName: polygon.properties.label ?? '',
                    text: 'LTN',
                    onOpenGroup: openGroupDetails
                }
            );
            if (descriptionPopup) {
                descriptionPopup.setLatLng(event.latlng ?? polygon.getBounds().getCenter());
                map.openPopup(descriptionPopup);
            }
            return;
        }

        const isModifierClick =
            (event.originalEvent?.shiftKey ||
                event.originalEvent?.ctrlKey ||
                event.originalEvent?.metaKey) ??
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
            L.DomEvent.stopPropagation(event.originalEvent ?? event);
            if (isPhaseSelection) {
                if (groupStore.phaseGroupId) {
                    selectionStore.markGroupSelection(groupStore.phaseGroupId);
                }
                selectionStore.setPhaseEditing(true);
            }
            selectFeature(polygon as unknown as L.Layer, LAYER_ID, true, isPhaseSelection, true);
            return;
        }

        if (isGroupEditing) {
            selectFeature(polygon as unknown as L.Layer, LAYER_ID, true, true, true);
            return;
        }

        if (
            (mapStore.drawLayerId !== null && mapStore.activeLayerId !== BUTTON_ID) ||
            (mapStore.drawLayerId === null &&
                mapStore.activeLayerId !== null &&
                mapStore.activeLayerId !== BUTTON_ID &&
                !isFeatureEditLayerButtonId(mapStore.activeLayerId))
        ) {
            return;
        }

        L.DomEvent.stopPropagation(event.originalEvent ?? event);

        if (isModifierClick) {
            selectFeature(polygon as unknown as L.Layer, LAYER_ID, true, false, true);
            return;
        }

        selectFeature(polygon as unknown as L.Layer, LAYER_ID, false, true);

        const editablePolygon = getEditablePolygon();
        if (editablePolygon && editablePolygon !== event.target) {
            editablePolygon.editing?.disable();
        }
        map.closePopup();
        selectForEdit();
        cursorController.enterEditMode();
        labelEl.value = polygon.properties.label ?? '';
        colorEl.value = polygon.options.color ?? defaultColor;
        cursorController.syncPolygonEditCursor(
            event.target?._path ?? null,
            event.originalEvent.clientX,
            event.originalEvent.clientY
        );
        event.target.editing.enable();
        setEditablePolygon(event.target);
        recomputeFeatureVisibility();
        popup.setLatLng(event.target.getBounds().getCenter());
        const focusPopupLabel = (popupEvent: L.PopupEvent): void => {
            if (popupEvent.popup !== popup) {
                return;
            }

            map.off('popupopen', focusPopupLabel);
            removePopupFocusHandler = null;
            labelEl.focus();
        };
        removePopupFocusHandler = () => {
            map.off('popupopen', focusPopupLabel);
            removePopupFocusHandler = null;
        };
        refreshGroupContent();
        map.on('popupopen', focusPopupLabel);
        map.openPopup(popup);
        labelEl.focus();
    };

    polygon.on('click', handleClick);
    return () => {
        removePopupFocusHandler?.();
        polygon.off('click', handleClick);
    };
}
