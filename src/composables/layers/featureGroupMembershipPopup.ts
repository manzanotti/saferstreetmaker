import type { GroupMember } from '../../models/Group';
import { findFeatureGroupMemberships } from '../../features/groups/featureMemberships';
import { useGroupStore } from '../../stores/groupStore';
import { pinia } from '../../stores/index';

export function disposePopupElement(element: HTMLElement | null | undefined): void {
    if (!element) {
        return;
    }

    const disposableElement = element as any;
    const dispose = disposableElement.__disposePopupListeners;
    if (typeof dispose !== 'function') {
        return;
    }

    delete disposableElement.__disposePopupListeners;
    dispose();
}

function buildFeatureGroupRemoveControl(ariaLabel: string, onActivate: () => void): HTMLLIElement {
    const item = document.createElement('li');
    const control = document.createElement('button');
    control.type = 'button';
    control.classList.add('remove-feature-button');
    control.setAttribute('aria-label', ariaLabel);
    control.title = ariaLabel;

    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('fill', 'none');
    icon.setAttribute('stroke', 'currentColor');
    icon.setAttribute('stroke-width', '2');
    icon.setAttribute('stroke-linecap', 'round');
    icon.setAttribute('stroke-linejoin', 'round');
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = '<circle cx="12" cy="12" r="9" /><path d="M8 12h8" />';
    control.appendChild(icon);
    const handleClick = () => onActivate();
    control.addEventListener('click', handleClick);
    item.appendChild(control);

    (item as any).__disposePopupListeners = () => {
        control.removeEventListener('click', handleClick);
    };

    return item;
}

export function buildFeatureGroupMembershipContent(
    member: GroupMember,
    onOpenGroup?: (groupId: string) => void,
    onRemoveFromGroup?: (groupId: string) => void,
    onAddToGroup?: (groupId: string) => void,
    onCreateNewGroup?: (member: GroupMember, onCreated?: (groupId: string) => void) => void
): HTMLDivElement {
    const content = document.createElement('div');
    content.classList.add('feature-popup-content');
    let disposeRenderedListeners: (() => void) | null = null;
    let disposed = false;
    const renderGroups = (selectedGroupId?: string) => {
        if (disposed) {
            return;
        }
        disposeRenderedListeners?.();
        const disposers: Array<() => void> = [];
        const groupStore = useGroupStore(pinia);
        const groups = findFeatureGroupMemberships(groupStore.groups, member);
        const groupsContent = document.createElement('section');
        groupsContent.classList.add('feature-popup-groups');

        const heading = document.createElement('strong');
        heading.textContent = 'Groups';
        groupsContent.appendChild(heading);

        const groupList = document.createElement('ul');
        if (groups.length === 0) {
            const noneItem = document.createElement('li');
            noneItem.classList.add('feature-popup-group-none');
            noneItem.textContent = 'None';
            groupList.appendChild(noneItem);
        } else {
            groups.forEach((group) => {
                const item = document.createElement('li');
                item.classList.add('feature-popup-group');

                const groupButton = document.createElement('button');
                groupButton.type = 'button';
                groupButton.classList.add('group-link');
                groupButton.textContent = group.groupName;
                if (group.versionCount > 1) {
                    groupButton.textContent += ` (${group.versionCount} versions)`;
                }
                const handleGroupClick = () => onOpenGroup?.(group.groupId);
                groupButton.addEventListener('click', handleGroupClick);
                disposers.push(() => groupButton.removeEventListener('click', handleGroupClick));
                item.appendChild(groupButton);

                if (onRemoveFromGroup) {
                    const removeControl = buildFeatureGroupRemoveControl(
                        `Remove feature from ${group.groupName}`,
                        () => {
                            onRemoveFromGroup(group.groupId);
                            renderGroups();
                        }
                    );
                    item.appendChild(removeControl);
                    disposers.push(() => disposePopupElement(removeControl));
                }

                groupList.appendChild(item);
            });
        }
        groupsContent.appendChild(groupList);

        if (onAddToGroup) {
            const addControl = document.createElement('div');
            addControl.classList.add('feature-popup-add-group');

            const groupSelect = document.createElement('select');
            groupSelect.classList.add('add-feature-to-group-select');
            groupSelect.setAttribute('aria-label', 'Select group to add feature to');

            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = 'Add to group…';
            groupSelect.appendChild(placeholder);

            if (onCreateNewGroup) {
                const createOption = document.createElement('option');
                createOption.value = '__create-new-group__';
                createOption.textContent = 'Create new group…';
                groupSelect.appendChild(createOption);
            }

            [...groupStore.groups]
                .sort((left, right) => left.name.localeCompare(right.name))
                .forEach((group) => {
                    const option = document.createElement('option');
                    option.value = group.id;
                    option.textContent = group.name;
                    groupSelect.appendChild(option);
                });

            if (selectedGroupId) {
                groupSelect.value = selectedGroupId;
            }

            const handleGroupChange = () => {
                if (!groupSelect.value) {
                    return;
                }
                if (groupSelect.value === '__create-new-group__') {
                    onCreateNewGroup?.(member, (groupId) => renderGroups(groupId));
                } else {
                    onAddToGroup(groupSelect.value);
                }
                renderGroups();
            };
            groupSelect.addEventListener('change', handleGroupChange);
            disposers.push(() => groupSelect.removeEventListener('change', handleGroupChange));

            addControl.appendChild(groupSelect);
            groupsContent.appendChild(addControl);
        }

        const currentGroupsContent = content.querySelector('.feature-popup-groups');
        if (currentGroupsContent) {
            currentGroupsContent.replaceWith(groupsContent);
        } else {
            content.prepend(groupsContent);
        }
        disposeRenderedListeners = () => {
            disposers.forEach((dispose) => dispose());
        };
    };

    renderGroups();

    (content as any).__disposePopupListeners = () => {
        disposed = true;
        disposeRenderedListeners?.();
        disposeRenderedListeners = null;
    };

    return content;
}
