import type * as L from 'leaflet';
import type { GroupMember } from '../../../models/Group';
import { pinia } from '../../../stores/index';
import { useSettingsStore } from '../../../stores/settingsStore';
import {
    buildFeatureDescriptionPopup,
    type FeatureDescriptionPopupDetails
} from './featureDescriptionPopup';
import { setFeatureElementCursor } from './featureCursors';
import { cacheFeatureGroupElement, findFirstFeatureGroupId } from './featureGroupMembershipPopup';
import {
    addFeatureHoverPopup,
    closeFeatureHoverPopups,
    createFeatureHoverPopupController,
    getFeatureHoverLatLng
} from './featureHoverPopups';
import { buildReadOnlyGroupPopup, getReadOnlyGroupCenter } from './readOnlyGroupPopup';

interface FeatureGroupHoverOptions {
    feature: L.Layer;
    getMap: () => L.Map | null;
    member: GroupMember;
    getCenter: () => L.LatLng;
    getCursorTarget: (event: L.LeafletMouseEvent) => unknown;
    onOpenGroup: (groupId: string) => void;
    getDescriptionDetails: () => FeatureDescriptionPopupDetails;
}

export function attachFeatureGroupHover(options: FeatureGroupHoverOptions): void {
    const hoverPopupController = createFeatureHoverPopupController();
    options.feature.on('mouseover', (event: L.LeafletMouseEvent) => {
        const map = options.getMap();
        if (!map) {
            return;
        }

        closeFeatureHoverPopups(map);
        const groupId = findFirstFeatureGroupId(options.member);
        cacheFeatureGroupElement(event.originalEvent.target as Element | null, groupId);
        if (useSettingsStore(pinia).readOnly) {
            setFeatureElementCursor(
                options.getCursorTarget(event),
                groupId ? 'pointer' : 'default'
            );
            if (!groupId) {
                return;
            }
            const groupPopup = buildReadOnlyGroupPopup(groupId, options.onOpenGroup);
            if (groupPopup) {
                const center = getReadOnlyGroupCenter(groupId) ?? options.getCenter();
                hoverPopupController.set(groupPopup);
                addFeatureHoverPopup(
                    map,
                    groupPopup,
                    getFeatureHoverLatLng(map, center, event.latlng),
                    () => hoverPopupController.close(groupPopup)
                );
            }
            return;
        }
        if (!groupId) {
            return;
        }

        const descriptionPopup = buildFeatureDescriptionPopup(
            { minWidth: 30, keepInView: true },
            options.member,
            'hover',
            options.getDescriptionDetails()
        );
        if (descriptionPopup) {
            hoverPopupController.set(descriptionPopup);
            addFeatureHoverPopup(
                map,
                descriptionPopup,
                getFeatureHoverLatLng(map, options.getCenter(), event.latlng),
                () => hoverPopupController.close(descriptionPopup)
            );
        }
    });

    options.feature.on('mouseout', () => {
        setFeatureElementCursor(options.feature, null);
        hoverPopupController.scheduleClose();
    });
}
