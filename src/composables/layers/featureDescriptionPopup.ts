import * as L from 'leaflet';
import { findFeatureGroupMemberships } from '../../features/groups/featureMemberships';
import type { GroupMember } from '../../models/Group';
import { useGroupStore } from '../../stores/groupStore';
import { pinia } from '../../stores/index';

const FEATURE_TYPE_NAMES: Record<string, string> = {
    ModalFilters: 'Modal filter',
    BusGates: 'Bus gate',
    TrafficLights: 'Traffic light',
    PedestrianLights: 'Pedestrian light',
    ZebraCrossing: 'Zebra crossing',
    MobilityLanes: 'Mobility lane',
    TramLines: 'Tram line',
    BusLanes: 'Bus lane',
    CarFreeStreets: 'Car-free street',
    SchoolStreet: 'School street',
    OneWayStreets: 'One-way street',
    LtnCells: 'LTN cell'
};

export interface FeatureDescriptionPopupDetails {
    featureName?: string;
    iconSrc?: string;
    text?: string;
    onOpenGroup?: (groupId: string) => void;
}

export function buildFeatureDescriptionPopup(
    popupOptions: L.PopupOptions,
    member: GroupMember,
    popupType: 'hover' | 'click' = 'hover',
    details?: FeatureDescriptionPopupDetails
): L.Popup | null {
    const content = document.createElement('div');
    content.classList.add('feature-popup-content');
    content.classList.add('feature-popup-hover-content');
    const groups = findFeatureGroupMemberships(useGroupStore(pinia).groups, member);

    const featureTypeName = FEATURE_TYPE_NAMES[member.layerId] ?? member.layerId;
    if (groups.length === 0 && !details?.featureName) {
        return null;
    }

    const popup = L.popup({
        ...popupOptions,
        autoClose: false,
        autoPan: popupType !== 'hover',
        className: popupType === 'hover' ? 'feature-popup-hover' : 'feature-popup-description'
    });

    if (groups.length > 0 || details?.featureName) {
        if (details?.iconSrc) {
            const featureIcon = document.createElement('img');
            featureIcon.classList.add('feature-popup-feature-icon');
            featureIcon.src = details.iconSrc;
            featureIcon.alt = featureTypeName;
            content.appendChild(featureIcon);
        } else if (details?.text) {
            const featureText = document.createElement('span');
            featureText.classList.add(
                'feature-popup-feature-text',
                'text-xl',
                'font-bold',
                'leading-none',
                'text-gray-700'
            );
            featureText.textContent = details.text;
            featureText.setAttribute('aria-hidden', 'true');
            content.appendChild(featureText);
        }
    }

    if (details?.featureName) {
        const name = document.createElement('div');
        name.classList.add('feature-popup-feature-name');
        name.textContent = details.featureName;
        content.appendChild(name);
    }

    groups.forEach((group) => {
        const groupContent = document.createElement('section');
        groupContent.classList.add('feature-popup-group-description');

        const heading = details?.onOpenGroup
            ? document.createElement('button')
            : document.createElement('strong');
        heading.textContent = group.groupName;
        if (details?.onOpenGroup) {
            (heading as HTMLButtonElement).type = 'button';
            heading.classList.add('group-link');
            heading.addEventListener('click', () => details.onOpenGroup?.(group.groupId));
        }
        groupContent.appendChild(heading);

        if (group.description) {
            const description = document.createElement('div');
            description.classList.add('feature-popup-description');
            description.innerHTML = group.description;
            groupContent.appendChild(description);
        }
        content.appendChild(groupContent);
    });

    popup.setContent(content);
    return popup;
}
