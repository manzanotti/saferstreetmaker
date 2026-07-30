/**
 * layerUtils.ts
 *
 * Shared helpers for layer composables (cursor, toolbar button, legend entry).
 * Extracted from LayerHelpers.ts — PubSub removed entirely.
 *
 * Note on DOM usage: `buildLegendEntry` and `buildDeletePopup` use
 * `document.createElement` to construct HTML for Leaflet popups and the legacy
 * `getLegendEntry()` interface method. This is intentional — Leaflet manages
 * those DOM subtrees directly and they live outside Vue's virtual DOM.
 * Do not replace these with Vue components; keep the boundary here.
 */
import * as L from 'leaflet';
import { ToolbarButton } from '../../models/ToolbarButton';
import { findFeatureGroupMemberships } from '../../features/groups/featureMemberships';
import { useGroupStore } from '../../stores/groupStore';
import { pinia } from '../../stores/index';
import type { GroupMember } from '../../models/Group';

// ---------------------------------------------------------------------------
// Cursor helpers
// ---------------------------------------------------------------------------

export function setMapCursor(cssClass: string): void {
    const map = document.getElementById('map');
    map?.classList.remove('leaflet-grab');
    map?.classList.add(cssClass);
}

export function removeMapCursor(cssClass: string): void {
    const map = document.getElementById('map');
    map?.classList.remove(cssClass);
    map?.classList.add('leaflet-grab');
}

/**
 * Read a feature's history id from a Leaflet layer, tolerating the two storage
 * conventions in use across the app:
 *   - Points and polylines attach a GeoJSON `feature`, so the id lives at
 *     `feature.properties.historyId`.
 *   - LTN polygons keep their metadata on a plain `properties` bag, so the id
 *     lives at `properties.historyId`.
 * Returns null when neither is present. Centralising this lookup avoids the
 * class of bugs where one call site checks only one location and silently
 * fails to identify polygons.
 */
export function getFeatureHistoryId(marker: unknown): string | null {
    const layer = marker as {
        feature?: { properties?: { historyId?: unknown } };
        properties?: { historyId?: unknown };
    } | null;
    const id = layer?.feature?.properties?.historyId ?? layer?.properties?.historyId;
    return typeof id === 'string' && id !== '' ? id : null;
}

const POINT_FEATURE_CLASSES = [
    'modal-filter-marker',
    'bus-gate-icon',
    'traffic-lights-icon',
    'pedestrian-lights-icon',
    'zebra-crossing-icon'
];

const FEATURE_EDIT_LAYER_BUTTON_IDS = new Set([
    'mobility-lane',
    'tram-line',
    'car-free-street',
    'school-street',
    'one-way-street',
    'ltn'
]);

export function getPointSelectCursor(): string {
    const mapElement = document.getElementById('map');
    const cursor = mapElement
        ? getComputedStyle(mapElement).getPropertyValue('--point-select-cursor').trim()
        : '';

    return cursor === '' ? 'pointer' : cursor;
}

export function isPointFeatureElement(element: Element): boolean {
    return POINT_FEATURE_CLASSES.some((className) => element.classList.contains(className));
}

export function setMouseMarkerCursor(cursor: string | null): void {
    const marker = document.querySelector('.leaflet-mouse-marker') as HTMLElement | null;
    if (!marker) {
        return;
    }

    if (cursor === null) {
        marker.style.removeProperty('cursor');
    } else {
        marker.style.cursor = cursor;
    }
}

export function isFeatureEditLayerButtonId(id: string | null): boolean {
    return id !== null && FEATURE_EDIT_LAYER_BUTTON_IDS.has(id);
}

export function buildHistoryId(prefix: string): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------------------------------------------------------------------
// Toolbar button builder
// ---------------------------------------------------------------------------

export interface ToolbarButtonOpts {
    id: string;
    tooltip: string;
    groupName: string;
    action: (e: Event, map: L.Map) => void;
    selected: boolean;
    isFirst?: boolean;
    text?: string;
    iconSrc?: string;
}

export function buildToolbarButton(opts: ToolbarButtonOpts): ToolbarButton {
    return {
        id: opts.id,
        tooltip: opts.tooltip,
        groupName: opts.groupName,
        action: opts.action,
        selected: opts.selected,
        ...(opts.isFirst !== undefined ? { isFirst: opts.isFirst } : {}),
        ...(opts.text !== undefined ? { text: opts.text } : {}),
        ...(opts.iconSrc !== undefined ? { iconSrc: opts.iconSrc } : {})
    };
}

// ---------------------------------------------------------------------------
// Legend entry builder
// ---------------------------------------------------------------------------

export interface LegendEntryOpts {
    layerId: string;
    title: string;
    toggleTitle: string;
    iconEl: HTMLElement;
    /** Object whose `visible` property is toggled on click. */
    visibilityState: { visible: boolean };
}

export function buildLegendEntry(opts: LegendEntryOpts): HTMLElement {
    const li = document.createElement('li');
    li.id = `${opts.layerId}-legend`;
    li.setAttribute('title', opts.toggleTitle);
    li.appendChild(opts.iconEl);

    const span = document.createElement('span');
    span.textContent = opts.title;
    li.appendChild(span);

    li.addEventListener('click', () => {
        opts.visibilityState.visible = !opts.visibilityState.visible;
        // Actual map visibility is handled by Legend.vue → mapStore.toggleLayerVisibility()
    });

    return li;
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

// ---------------------------------------------------------------------------
// Popup builder for polyline / polygon controls
// ---------------------------------------------------------------------------

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
    onAddToGroup?: (groupId: string) => void
): HTMLDivElement {
    const content = document.createElement('div');
    content.classList.add('feature-popup-content');
    const renderGroups = () => {
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

            [...groupStore.groups]
                .sort((left, right) => left.name.localeCompare(right.name))
                .forEach((group) => {
                    const option = document.createElement('option');
                    option.value = group.id;
                    option.textContent = group.name;
                    groupSelect.appendChild(option);
                });

            groupSelect.addEventListener('change', () => {
                if (!groupSelect.value) {
                    return;
                }
                onAddToGroup(groupSelect.value);
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
    member: GroupMember
): L.Popup | null {
    const content = document.createElement('div');
    content.classList.add('feature-popup-content');
    content.classList.add('feature-popup-hover-content');
    const groups = findFeatureGroupMemberships(useGroupStore(pinia).groups, member);

    if (groups.length === 0) {
        return null;
    }

    const popup = L.popup({
        ...popupOptions,
        autoClose: false,
        className: 'feature-popup-hover'
    });

    groups.forEach((group) => {
        const groupContent = document.createElement('section');
        groupContent.classList.add('feature-popup-group-description');

        const heading = document.createElement('strong');
        heading.textContent = group.groupName;
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

export function closeFeatureHoverPopups(map: L.Map): void {
    if (typeof map.eachLayer !== 'function') {
        return;
    }

    map.eachLayer((layer: L.Layer) => {
        if ((layer as L.Popup).options?.className === 'feature-popup-hover') {
            map.removeLayer(layer);
        }
    });
}

export interface FeatureActionPopupOptions {
    map: L.Map;
    popupOptions: L.PopupOptions;
    member: GroupMember;
    onDelete: () => void;
    onCopy?: () => void;
    onOpenGroup?: (groupId: string) => void;
    onRemoveFromGroup?: (groupId: string) => void;
    onAddToGroup?: (groupId: string) => void;
}

export function setFeatureActionPopupContent(
    popup: L.Popup,
    opts: FeatureActionPopupOptions
): void {
    const content = buildFeatureGroupMembershipContent(
        opts.member,
        opts.onOpenGroup,
        opts.onRemoveFromGroup,
        opts.onAddToGroup
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
    content.prepend(controlList);
    popup.setContent(content);
}

export function buildFeatureActionPopup(opts: FeatureActionPopupOptions): L.Popup {
    const popup = L.popup(opts.popupOptions);
    setFeatureActionPopupContent(popup, opts);
    return popup;
}
