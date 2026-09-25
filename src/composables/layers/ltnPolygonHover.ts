import * as L from 'leaflet';
import { pinia } from '../../stores/index';
import { useMapStore } from '../../stores/mapStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { openGroupDetails } from '../useGroups';
import { setFeatureElementCursor } from './featureCursors';
import { buildFeatureDescriptionPopup } from './featureDescriptionPopup';
import {
    addFeatureHoverPopup,
    closeFeatureHoverPopups,
    createFeatureHoverPopupController,
    getFeatureHoverLatLng
} from './featureHoverPopups';
import { cacheFeatureGroupElement, findFirstFeatureGroupId } from './featureGroupMembershipPopup';
import { buildReadOnlyGroupPopup, getReadOnlyGroupCenter } from './readOnlyGroupPopup';
import type { createLtnCursorController } from './ltnCursorController';

const LAYER_ID = 'LtnCells';

interface LtnPolygonHoverOptions {
    map: L.Map;
    polygon: any;
    historyId: string;
    popup: L.Popup;
    getSelectionMode: () => 'draw' | 'edit';
    cursorController: ReturnType<typeof createLtnCursorController>;
}

export function attachLtnPolygonHoverInteractions(options: LtnPolygonHoverOptions): void {
    const { map, polygon, historyId, popup, getSelectionMode, cursorController } = options;
    const mapStore = useMapStore(pinia);
    const hoverPopupController = createFeatureHoverPopupController();
    polygon.__disposeLtnHoverPopup = () => hoverPopupController.dispose();

    polygon.on('mouseover', (event: L.LeafletMouseEvent) => {
        if (map.hasLayer(popup)) {
            return;
        }

        closeFeatureHoverPopups(map);
        const groupId = findFirstFeatureGroupId({ layerId: LAYER_ID, historyId });
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
            { layerId: LAYER_ID, historyId },
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

    polygon.on('mouseout', () => {
        setFeatureElementCursor(polygon, null);
        hoverPopupController.scheduleClose();

        if (getSelectionMode() !== 'edit' || mapStore.activeLayerId !== 'ltn') {
            return;
        }

        cursorController.resetPolygonCursor();
    });
}
