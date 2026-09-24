import * as L from 'leaflet';
import { getGroupVersions, needsReadOnlyGroupDetails } from '../../features/groups/groupVersions';
import { useGroupStore } from '../../stores/groupStore';
import { pinia } from '../../stores/index';

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
