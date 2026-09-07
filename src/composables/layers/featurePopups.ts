/**
 * featurePopups.ts
 *
 * Popup builders for feature deletion/action controls and descriptions.
 * Extracted from layerUtils.ts — pure mechanical split, no behavior changes.
 *
 * Note on DOM usage: these functions use `document.createElement` to construct
 * HTML for Leaflet popups. This is intentional — Leaflet manages those DOM
 * subtrees directly and they live outside Vue's virtual DOM. Do not replace
 * these with Vue components; keep the boundary here.
 */
import * as L from 'leaflet';
import { findFeatureGroupMemberships } from '../../features/groups/featureMemberships';
import { needsReadOnlyGroupDetails, getGroupVersions } from '../../features/groups/groupVersions';
import { useGroupStore } from '../../stores/groupStore';
import { pinia } from '../../stores/index';
import type { GroupMember } from '../../models/Group';

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

export function buildPopupActionControl(
    cssClass: string,
    ariaLabel: string,
    onActivate: () => void
): HTMLLIElement {
    const item = document.createElement('li');
    const control = document.createElement('button');
    control.type = 'button';
    control.classList.add(cssClass);
    control.setAttribute('aria-label', ariaLabel);
    control.title = ariaLabel;

    const activate = () => {
        onActivate();
    };

    control.addEventListener('click', activate);

    item.appendChild(control);

    return item;
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
    control.addEventListener('click', onActivate);
    item.appendChild(control);

    return item;
}

/**
 * Build a Leaflet popup containing optional Copy and mandatory Delete controls.
 * Pass `onCopy` to render a Copy button before the Delete button.
 * Both buttons close the popup after firing their callback.
 */
export function buildDeletePopup(
    map: L.Map,
    popupOptions: L.PopupOptions,
    onDelete: () => void,
    onCopy?: () => void
): L.Popup {
    const popup = L.popup(popupOptions);

    const controlList = document.createElement('ul');
    controlList.classList.add('popup-buttons');

    if (onCopy) {
        const copyControl = buildPopupActionControl('copy-button', 'Copy selected feature', () => {
            onCopy();
            map.closePopup(popup);
        });
        controlList.appendChild(copyControl);
    }

    const deleteControl = buildPopupActionControl(
        'delete-button',
        'Delete selected feature',
        () => {
            onDelete();
            map.closePopup(popup);
        }
    );
    controlList.appendChild(deleteControl);
    popup.setContent(controlList);

    return popup;
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
    const renderGroups = (selectedGroupId?: string) => {
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
                groupButton.addEventListener('click', () => onOpenGroup?.(group.groupId));
                item.appendChild(groupButton);

                if (onRemoveFromGroup) {
                    item.appendChild(
                        buildFeatureGroupRemoveControl(
                            `Remove feature from ${group.groupName}`,
                            () => {
                                onRemoveFromGroup(group.groupId);
                                renderGroups();
                            }
                        )
                    );
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

            groupSelect.addEventListener('change', () => {
                if (!groupSelect.value) {
                    return;
                }
                if (groupSelect.value === '__create-new-group__') {
                    onCreateNewGroup?.(member, (groupId) => renderGroups(groupId));
                } else {
                    onAddToGroup(groupSelect.value);
                }
                renderGroups();
            });

            addControl.appendChild(groupSelect);
            groupsContent.appendChild(addControl);
        }

        const currentGroupsContent = content.querySelector('.feature-popup-groups');
        if (currentGroupsContent) {
            currentGroupsContent.replaceWith(groupsContent);
        } else {
            content.prepend(groupsContent);
        }
    };

    renderGroups();

    return content;
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

export interface FeatureActionPopupOptions {
    map: L.Map;
    popupOptions: L.PopupOptions;
    member: GroupMember;
    onDelete: () => void;
    onCopy?: () => void;
    name?: string;
    onRename?: (name: string) => void;
    onOpenGroup?: (groupId: string) => void;
    onRemoveFromGroup?: (groupId: string) => void;
    onAddToGroup?: (groupId: string) => void;
    onCreateNewGroup?: (member: GroupMember, onCreated?: (groupId: string) => void) => void;
}

export function setFeatureActionPopupContent(
    popup: L.Popup,
    opts: FeatureActionPopupOptions
): void {
    const content = buildFeatureGroupMembershipContent(
        opts.member,
        opts.onOpenGroup,
        opts.onRemoveFromGroup,
        opts.onAddToGroup,
        opts.onCreateNewGroup
    );
    const controlList = document.createElement('ul');
    controlList.classList.add('popup-buttons');

    if (opts.onCopy) {
        controlList.appendChild(
            buildPopupActionControl('copy-button', 'Copy selected feature', () => {
                opts.onCopy?.();
                opts.map.closePopup(popup);
            })
        );
    }
    controlList.appendChild(
        buildPopupActionControl('delete-button', 'Delete selected feature', () => {
            opts.onDelete();
            opts.map.closePopup(popup);
        })
    );

    if (opts.onRename) {
        const nameForm = document.createElement('form');
        nameForm.classList.add('feature-name-editor');

        const nameInputRow = document.createElement('div');
        nameInputRow.classList.add('feature-name-input-row');

        const nameLabel = document.createElement('label');
        nameLabel.textContent = 'Name';

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = opts.name ?? '';
        nameInput.classList.add('name-editor');
        nameLabel.appendChild(nameInput);
        nameInputRow.appendChild(nameLabel);

        const nameSaveRow = document.createElement('div');
        nameSaveRow.classList.add('feature-name-save-row');
        const saveNameButton = document.createElement('button');
        saveNameButton.type = 'submit';
        saveNameButton.classList.add('apply-name-button');
        saveNameButton.textContent = 'Save name';
        nameSaveRow.appendChild(saveNameButton);

        nameForm.append(nameInputRow, nameSaveRow);
        nameForm.addEventListener('submit', (event) => {
            event.preventDefault();
            opts.onRename?.(nameInput.value);
            opts.map.closePopup(popup);
        });
        content.prepend(nameForm, controlList);
    } else {
        content.prepend(controlList);
    }

    popup.setContent(content);
}

export function buildFeatureActionPopup(opts: FeatureActionPopupOptions): L.Popup {
    const popup = L.popup(opts.popupOptions);
    setFeatureActionPopupContent(popup, opts);
    return popup;
}
