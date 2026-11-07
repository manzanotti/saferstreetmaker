import * as L from 'leaflet';
import { pinia } from '../../../stores/index';
import { useMapStore } from '../../../stores/mapStore';
import { useSelectionStore } from '../../../stores/selectionStore';
import { useGroupStore } from '../../../stores/groupStore';
import { useSettingsStore } from '../../../stores/settingsStore';
import { selectFeature, executeAreaDelete, executeCopy } from '../../useAreaSelection';
import {
    addFeatureToGroup,
    createGroupFromFeature,
    openGroupDetails,
    removeFeatureFromGroup
} from '../../useGroups';
import {
    buildFeatureActionPopup,
    setFeatureActionPopupContent,
    type FeatureActionPopupOptions
} from './featureActionPopup';
import { buildFeatureDescriptionPopup } from './featureDescriptionPopup';
import { closeFeatureHoverPopups } from './featureHoverPopups';
import { attachFeatureGroupHover } from './featureGroupHover';
import { removeMapCursor } from './featureCursors';
import { isFeatureEditLayerButtonId } from './featureClassification';
import { findFirstFeatureGroupId } from './featureGroupMembershipPopup';

interface PolylineInteractionOptions {
    polyline: L.Polyline<GeoJSON.Geometry>;
    geoJsonLayer: L.GeoJSON;
    map: L.Map;
    layerId: string;
    buttonId: string;
    historyId: string;
    selectForEdit: () => void;
    getName: () => string;
    rename: (name: string) => void;
    popupKeepInView?: boolean;
    iconSrc?: string;
}

export function attachPolylineInteractions(opts: PolylineInteractionOptions): L.Popup {
    const { polyline, geoJsonLayer, map, layerId, buttonId, historyId } = opts;
    const mapStore = useMapStore(pinia);
    const member = { layerId, historyId };

    attachFeatureGroupHover({
        feature: polyline,
        getMap: () => map,
        member,
        getCenter: () => polyline.getBounds().getCenter(),
        getCursorTarget: () => polyline,
        onOpenGroup: openGroupDetails,
        getDescriptionDetails: () => ({
            featureName: opts.getName(),
            iconSrc: opts.iconSrc,
            onOpenGroup: openGroupDetails
        })
    });

    const getActionOptions = (): FeatureActionPopupOptions => ({
        map,
        popupOptions: {
            minWidth: 30,
            keepInView: opts.popupKeepInView ?? true,
            className: 'feature-popup-editor'
        },
        member,
        name: opts.getName(),
        onRename: opts.rename,
        onDelete: () => {
            selectFeature(polyline, layerId, false);
            executeAreaDelete();
        },
        onCopy: () => {
            selectFeature(polyline, layerId, false);
            executeCopy();
        },
        onOpenGroup: openGroupDetails,
        onRemoveFromGroup: (groupId) => removeFeatureFromGroup(groupId, member),
        onAddToGroup: (groupId) => addFeatureToGroup(groupId, member),
        onCreateNewGroup: createGroupFromFeature
    });
    const popup = buildFeatureActionPopup(getActionOptions());

    let editingExistingFeature = false;
    popup.on('remove', () => {
        if (editingExistingFeature && mapStore.activeLayerId === buttonId) {
            mapStore.setDrawLayer(null);
        }
        editingExistingFeature = false;
    });

    polyline.on('click', (e: L.LeafletMouseEvent) => {
        // An armed drawing tool owns the click; edit mode can switch between features.
        if (
            (mapStore.drawLayerId !== null && mapStore.activeLayerId !== buttonId) ||
            (mapStore.drawLayerId === null &&
                mapStore.activeLayerId !== null &&
                mapStore.activeLayerId !== buttonId &&
                !isFeatureEditLayerButtonId(mapStore.activeLayerId))
        ) {
            return;
        }

        L.DomEvent.stopPropagation(e.originalEvent ?? e);
        closeFeatureHoverPopups(map);
        setFeatureActionPopupContent(popup, getActionOptions());

        if (useSettingsStore(pinia).readOnly) {
            const groupId = findFirstFeatureGroupId(member);
            if (groupId) {
                openGroupDetails(groupId);
                return;
            }
            const descriptionPopup = buildFeatureDescriptionPopup(
                { minWidth: 30, keepInView: true },
                member,
                'click',
                {
                    featureName: opts.getName(),
                    iconSrc: opts.iconSrc,
                    onOpenGroup: openGroupDetails
                }
            );
            if (descriptionPopup) {
                descriptionPopup.setLatLng(e.latlng);
                map.openPopup(descriptionPopup);
            }
            return;
        }

        const isModifierClick =
            (e.originalEvent?.shiftKey || e.originalEvent?.ctrlKey || e.originalEvent?.metaKey) ??
            false;
        const selectionStore = useSelectionStore(pinia);
        const groupStore = useGroupStore(pinia);
        const isGroupEditing =
            selectionStore.isGroupSelection && selectionStore.selectedGroupId !== null;

        if (groupStore.phaseDraftActive || isGroupEditing) {
            selectFeature(polyline, layerId, true, true, true);
            return;
        }
        if (isModifierClick) {
            selectFeature(polyline, layerId, true, false, true);
            return;
        }

        geoJsonLayer.eachLayer((layer: any) => {
            if (layer !== e.target) {
                layer.editing?.disable?.();
            }
        });

        editingExistingFeature = true;
        opts.selectForEdit();
        removeMapCursor(buttonId);
        e.target.editing.enable();
        selectFeature(polyline, layerId, false, true);
        popup.setLatLng(e.latlng);
        map.openPopup(popup);
    });

    return popup;
}
