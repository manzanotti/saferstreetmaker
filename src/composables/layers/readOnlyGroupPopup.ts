import * as L from 'leaflet';
import {
    getActiveVersion,
    getGroupVersions,
    needsReadOnlyGroupDetails
} from '../../features/groups/groupVersions';
import { useGroupStore } from '../../stores/groupStore';
import { useMapStore } from '../../stores/mapStore';
import { pinia } from '../../stores/index';
import { findLayerFeatureByHistoryId } from './featureLookup';

export function getReadOnlyGroupCenter(groupId: string): L.LatLng | null {
    const groupStore = useGroupStore(pinia);
    const group = groupStore.groups.find((item) => item.id === groupId);
    if (!group) {
        return null;
    }

    const version = getActiveVersion(group, groupStore.activeVersionIds[groupId]);
    const bounds = L.latLngBounds([]);
    const layers = useMapStore(pinia).layers;
    for (const member of version.members) {
        const feature = findLayerFeatureByHistoryId(layers, member.layerId, member.historyId) as
            | (L.Layer & {
                  getBounds?: () => L.LatLngBounds;
                  getLatLng?: () => L.LatLng;
              })
            | null;
        if (!feature) {
            continue;
        }
        if (typeof feature.getBounds === 'function') {
            bounds.extend(feature.getBounds());
        } else if (typeof feature.getLatLng === 'function') {
            bounds.extend(feature.getLatLng());
        }
    }

    return bounds.isValid() ? bounds.getCenter() : null;
}

export function buildReadOnlyGroupPopup(
    groupId: string,
    onOpenGroup?: (groupId: string) => void
): L.Popup | null {
    const group = useGroupStore(pinia).groups.find((item) => item.id === groupId);
    if (!group) {
        return null;
    }

    const content = document.createElement('div');
    content.classList.add('feature-popup-content', 'group-popup-content');

    const heading = needsReadOnlyGroupDetails(group)
        ? document.createElement('button')
        : document.createElement('strong');
    heading.classList.add('group-popup-title');
    heading.textContent = group.name;
    if (heading instanceof HTMLButtonElement) {
        heading.type = 'button';
        heading.classList.add('group-link');
        heading.setAttribute('aria-label', `Open group ${group.name}`);
        heading.addEventListener('click', () => onOpenGroup?.(group.id));
    }
    content.appendChild(heading);

    if (group.description) {
        const description = document.createElement('div');
        description.classList.add('feature-popup-description');
        description.innerHTML = group.description;
        content.appendChild(description);
    }

    const summary = document.createElement('div');
    summary.classList.add('group-popup-summary');
    const versions = getGroupVersions(group);
    const featureCount = new Set(
        versions.flatMap((version) =>
            version.members.map((member) => `${member.layerId}:${member.historyId}`)
        )
    ).size;
    summary.textContent = `${featureCount} feature${featureCount === 1 ? '' : 's'} · ${versions.length} version${versions.length === 1 ? '' : 's'}`;
    content.appendChild(summary);

    return L.popup({ minWidth: 30, keepInView: true, className: 'group-popup' }).setContent(
        content
    );
}
