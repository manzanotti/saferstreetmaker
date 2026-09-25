import * as L from 'leaflet';
import type { GroupMember } from '../../models/Group';
import { buildFeatureGroupMembershipContent } from './featureGroupMembershipPopup';

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

    (item as any).__disposePopupListeners = () => {
        control.removeEventListener('click', activate);
    };

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
