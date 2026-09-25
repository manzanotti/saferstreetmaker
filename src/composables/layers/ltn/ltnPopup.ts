import * as L from 'leaflet';
import type { GroupMember } from '../../../models/Group';
import { buildPopupActionControl } from '../features/featureActionPopup';
import {
    buildFeatureGroupMembershipContent,
    disposePopupElement
} from '../features/featureGroupMembershipPopup';

interface LtnPopupOptions {
    defaultColor: string;
    getHistoryFeature: () => any;
    onPolygonMutation: (beforeFeature: any, afterFeature: any) => void;
    syncTooltip: (label: string) => void;
    recomputeFeatureVisibility: () => void;
    onCopy: (popup: L.Popup) => void;
    onDelete: (popup: L.Popup) => void;
    onOpenGroup: (groupId: string) => void;
    onRemoveFromGroup: (groupId: string) => void;
    onAddToGroup: (groupId: string) => void;
    onCreateNewGroup: (member: GroupMember, onCreated?: (groupId: string) => void) => void;
}

export function createLtnPopup(
    map: L.Map,
    polygon: any,
    initialLabel: string,
    options: LtnPopupOptions
): {
    popup: L.Popup;
    labelEl: HTMLInputElement;
    colorEl: HTMLInputElement;
    refreshGroupContent: () => void;
    dispose: () => void;
} {
    const popup = L.popup({
        minWidth: 30,
        keepInView: true,
        className: 'feature-popup-editor'
    });
    const controlList = document.createElement('ul');
    controlList.classList.add('popup-buttons', 'ltn-popup-buttons');
    const currentControls = document.createElement('li');
    currentControls.classList.add('current-controls');
    const currentControlsContent = document.createElement('ul');
    currentControlsContent.classList.add('current-controls-content');
    currentControls.appendChild(currentControlsContent);
    controlList.appendChild(currentControls);

    const labelControl = document.createElement('li');
    const labelEl = document.createElement('input');
    labelEl.type = 'text';
    labelEl.value = initialLabel;
    labelEl.classList.add('label-editor');
    labelEl.setAttribute('aria-label', 'LTN cell label');
    labelControl.appendChild(labelEl);
    currentControlsContent.appendChild(labelControl);

    const colorControl = document.createElement('li');
    const colorEl = document.createElement('input');
    colorEl.type = 'color';
    colorEl.value = polygon.options.color ?? options.defaultColor;
    colorEl.classList.add('colour-swatch');
    colorEl.setAttribute('aria-label', 'Change cell colour');
    colorEl.title = 'Change cell colour';
    colorControl.appendChild(colorEl);
    currentControlsContent.appendChild(colorControl);

    const copyControl = buildPopupActionControl('copy-button', 'Copy selected feature', () => {
        options.onCopy(popup);
    });
    currentControlsContent.appendChild(copyControl);

    let metadataBeforeFeature: any = null;

    const flushMetadataChanges = (): void => {
        if (!metadataBeforeFeature) {
            return;
        }

        options.onPolygonMutation(metadataBeforeFeature, options.getHistoryFeature());
        metadataBeforeFeature = null;
    };

    const deleteControl = buildPopupActionControl(
        'delete-button',
        'Delete selected feature',
        () => {
            flushMetadataChanges();
            options.onDelete(popup);
        }
    );
    currentControlsContent.appendChild(deleteControl);

    const saveMetadataChanges = (): void => {
        const currentLabel = polygon['properties'].label ?? '';
        const currentColor = polygon.options.color ?? options.defaultColor;
        if (labelEl.value === currentLabel && colorEl.value === currentColor) {
            return;
        }

        const previousFeature = polygon['historyFeature'] ?? options.getHistoryFeature();
        metadataBeforeFeature ??= previousFeature;
        polygon['properties'].label = labelEl.value;
        options.syncTooltip(labelEl.value);
        polygon.setStyle({ color: colorEl.value });
        polygon['historyFeature'] = options.getHistoryFeature();
        options.recomputeFeatureVisibility();
    };

    const handleLabelInput = () => saveMetadataChanges();
    const handleColorInput = () => saveMetadataChanges();
    const handleLabelChange = () => flushMetadataChanges();
    const handleColorChange = () => flushMetadataChanges();
    const handleLabelKeydown = (event: KeyboardEvent) => {
        if (event.key !== 'Enter') {
            return;
        }

        event.preventDefault();
        flushMetadataChanges();
        map.closePopup(popup);
    };

    labelEl.addEventListener('input', handleLabelInput);
    colorEl.addEventListener('input', handleColorInput);
    labelEl.addEventListener('change', handleLabelChange);
    colorEl.addEventListener('change', handleColorChange);
    labelEl.addEventListener('keydown', handleLabelKeydown);

    const popupContent = document.createElement('div');
    popupContent.classList.add('feature-popup-content');
    let groupContent: HTMLDivElement | null = null;
    const refreshGroupContent = () => {
        if (groupContent) {
            disposePopupElement(groupContent);
        }
        controlList.querySelectorAll('.feature-popup-group-content').forEach((groupContent) => {
            groupContent.remove();
        });
        const groupContentItem = document.createElement('li');
        groupContentItem.classList.add('feature-popup-group-content');
        groupContent = buildFeatureGroupMembershipContent(
            { layerId: 'LtnCells', historyId: polygon.properties.historyId },
            options.onOpenGroup,
            (groupId) => {
                flushMetadataChanges();
                options.onRemoveFromGroup(groupId);
            },
            (groupId) => {
                flushMetadataChanges();
                options.onAddToGroup(groupId);
            },
            (member, onCreated) => {
                flushMetadataChanges();
                options.onCreateNewGroup(member, onCreated);
            }
        );
        groupContentItem.appendChild(groupContent);
        controlList.appendChild(groupContentItem);
    };
    popupContent.appendChild(controlList);
    refreshGroupContent();
    popup.setContent(popupContent);
    return {
        popup,
        labelEl,
        colorEl,
        refreshGroupContent,
        dispose: () => {
            map.closePopup(popup);
            labelEl.removeEventListener('input', handleLabelInput);
            colorEl.removeEventListener('input', handleColorInput);
            labelEl.removeEventListener('change', handleLabelChange);
            colorEl.removeEventListener('change', handleColorChange);
            labelEl.removeEventListener('keydown', handleLabelKeydown);
            disposePopupElement(copyControl);
            disposePopupElement(deleteControl);
            disposePopupElement(groupContent);
        }
    };
}
