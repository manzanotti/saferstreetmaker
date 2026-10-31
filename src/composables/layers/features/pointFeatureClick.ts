import * as L from 'leaflet';
import { useMapStore } from '../../../stores/mapStore';
import { pinia } from '../../../stores/index';
import { useSelectionStore } from '../../../stores/selectionStore';
import { useGroupStore } from '../../../stores/groupStore';
import { useSettingsStore } from '../../../stores/settingsStore';
import { executeAreaDelete, executeCopy, selectFeature } from '../../useAreaSelection';
import {
    addFeatureToGroup,
    createGroupFromFeature,
    openGroupDetails,
    removeFeatureFromGroup
} from '../../useGroups';
import { getFeatureHistoryId } from './featureLookup';
import { buildFeatureActionPopup } from './featureActionPopup';
import { buildFeatureDescriptionPopup } from './featureDescriptionPopup';
import { closeFeatureHoverPopups } from './featureHoverPopups';
import { findFirstFeatureGroupId } from './featureGroupMembershipPopup';

export function getPointEventLatLng(event: {
    target?: { getLatLng?: () => L.LatLng };
    latlng?: L.LatLng;
}) {
    return event.target?.getLatLng?.() ?? event.latlng ?? null;
}

/**
 * While an area selection is active, point clicks add to the selection;
 * otherwise they open the feature popup.
 */
export function handlePointFeatureClick(
    event: L.LeafletMouseEvent,
    layerId: string,
    iconSrc?: string
): void {
    L.DomEvent.stopPropagation(event);

    const selectionStore = useSelectionStore(pinia);
    const groupStore = useGroupStore(pinia);
    const readOnly = useSettingsStore(pinia).readOnly;
    const isPhaseSelection = groupStore.phaseDraftActive;
    const isGroupEditing =
        selectionStore.isGroupSelection && selectionStore.selectedGroupId !== null;
    const isModifierClick =
        event.originalEvent?.shiftKey ||
        event.originalEvent?.ctrlKey ||
        event.originalEvent?.metaKey;
    if (
        !readOnly &&
        (selectionStore.isActive ||
            selectionStore.isPhaseEditing ||
            isPhaseSelection ||
            isGroupEditing ||
            isModifierClick)
    ) {
        selectFeature(
            event.target as unknown as L.Layer,
            layerId,
            true,
            isPhaseSelection || isGroupEditing,
            isModifierClick || isPhaseSelection || isGroupEditing
        );
        return;
    }

    const mapStore = useMapStore(pinia);
    const latLng = getPointEventLatLng(event);
    const historyId = getFeatureHistoryId(event.target);
    const map = mapStore.map;
    if (!map || !historyId) {
        return;
    }

    const member = { layerId, historyId };
    closeFeatureHoverPopups(map);
    if (readOnly) {
        const groupId = findFirstFeatureGroupId(member);
        if (groupId) {
            openGroupDetails(groupId);
            return;
        }
        const descriptionPopup = buildFeatureDescriptionPopup(
            { minWidth: 30, keepInView: true },
            member,
            'click',
            { iconSrc, onOpenGroup: openGroupDetails }
        );
        descriptionPopup?.setLatLng(latLng ?? map.getCenter()).openOn(map);
        return;
    }

    const popup = buildFeatureActionPopup({
        map,
        popupOptions: { minWidth: 30, keepInView: true },
        member,
        onDelete: () => {
            selectFeature(event.target as unknown as L.Layer, layerId, false);
            executeAreaDelete();
        },
        onCopy: () => {
            selectFeature(event.target as unknown as L.Layer, layerId, false);
            executeCopy();
        },
        onOpenGroup: openGroupDetails,
        onRemoveFromGroup: (groupId) => removeFeatureFromGroup(groupId, member),
        onAddToGroup: (groupId) => addFeatureToGroup(groupId, member),
        onCreateNewGroup: createGroupFromFeature
    });
    popup.setLatLng(latLng ?? map.getCenter()).openOn(map);
}
