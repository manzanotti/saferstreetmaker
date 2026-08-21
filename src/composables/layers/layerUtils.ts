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
import {
    getActiveVersion,
    getGroupVersions,
    needsReadOnlyGroupDetails
} from '../../features/groups/groupVersions';
import { useGroupStore } from '../../stores/groupStore';
import { useMapStore } from '../../stores/mapStore';
import { pinia } from '../../stores/index';
import type { GroupMember } from '../../models/Group';
import type { IMapLayer } from './IMapLayer';

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

export function setFeatureElementCursor(feature: unknown, cursor: string | null): void {
    const layer = feature as { _icon?: HTMLElement; _path?: SVGElement } | null;
    const element =
        feature instanceof HTMLElement || feature instanceof SVGElement
            ? feature
            : (layer?._icon ?? layer?._path);
    if (!element) {
        return;
    }
    const elements = [element, ...element.querySelectorAll<HTMLElement | SVGElement>('*')];
    for (const child of elements) {
        if (cursor === null) {
            child.style.removeProperty('cursor');
        } else {
            child.style.setProperty('cursor', cursor, 'important');
        }
    }
}

const featureGroupIds = new WeakMap<Element, string | null>();

export function cacheFeatureGroupElement(element: Element | null, groupId: string | null): void {
    if (element) {
        featureGroupIds.set(element, groupId);
    }
}

export function findFeatureGroupIdByElement(element: Element): string | null {
    return featureGroupIds.get(element) ?? null;
}

export function findLayerFeatureByHistoryId(
    layers: IMapLayer[],
    layerId: string,
    historyId: string
): L.Layer | null {
    const layer = layers.find((item) => item.id === layerId)?.getLayer();
    let found: L.Layer | null = null;
    layer?.eachLayer((feature) => {
        if (getFeatureHistoryId(feature) === historyId) {
            found = feature;
        }
    });
    return found;
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

const FEATURE_TYPE_NAMES: Record<string, string> = {
    ModalFilters: 'Modal filter',
    BusGates: 'Bus gate',
    TrafficLights: 'Traffic light',
    PedestrianLights: 'Pedestrian light',
    ZebraCrossing: 'Zebra crossing',
    MobilityLanes: 'Mobility lane',
    TramLines: 'Tram line',
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

export function findFirstFeatureGroupId(member: GroupMember): string | null {
    return findFeatureGroupMemberships(useGroupStore(pinia).groups, member)[0]?.groupId ?? null;
}

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

export function addFeatureHoverPopup(
    map: L.Map,
    popup: L.Popup,
    latLng: L.LatLng,
    onPopupLeave?: () => void
): void {
    popup.setLatLng(latLng).addTo(map);

    const element = popup.getElement();
    if (!element) {
        return;
    }

    L.DomEvent.disableClickPropagation(element);
    element.addEventListener('mouseleave', () => onPopupLeave?.());

    const mapSize = map.getSize();
    const popupWidth = element.offsetWidth;
    const popupHeight = element.offsetHeight;
    const anchor = map.latLngToContainerPoint(latLng);
    const padding = 12;
    const minX = padding + popupWidth / 2;
    const maxX = Math.max(minX, mapSize.x - padding - popupWidth / 2);
    const minY = padding + popupHeight;
    const maxY = Math.max(minY, mapSize.y - padding);
    const adjustedAnchor = L.point(
        Math.min(Math.max(anchor.x, minX), maxX),
        Math.min(Math.max(anchor.y, minY), maxY)
    );

    if (adjustedAnchor.x !== anchor.x || adjustedAnchor.y !== anchor.y) {
        popup.setLatLng(map.containerPointToLatLng(adjustedAnchor));
    }

    const mapContainer = map.getContainer?.();
    if (!mapContainer) {
        return;
    }

    const legend = mapContainer.querySelector<HTMLElement>('.legend');
    if (!legend) {
        return;
    }

    const mapRect = mapContainer.getBoundingClientRect();
    const popupRect = element.getBoundingClientRect();
    const legendRect = legend.getBoundingClientRect();
    const overlapsLegend =
        popupRect.left < legendRect.right &&
        popupRect.right > legendRect.left &&
        popupRect.top < legendRect.bottom &&
        popupRect.bottom > legendRect.top;

    if (!overlapsLegend) {
        return;
    }

    const legendLeft = legendRect.left - mapRect.left;
    const shiftedLeftAnchor = legendLeft - padding - popupWidth / 2;
    if (shiftedLeftAnchor >= minX) {
        adjustedAnchor.x = Math.min(adjustedAnchor.x, shiftedLeftAnchor);
    } else {
        const legendBottom = legendRect.bottom - mapRect.top;
        const shiftedBelowAnchor = legendBottom + padding + popupHeight;
        adjustedAnchor.y = Math.min(Math.max(adjustedAnchor.y, shiftedBelowAnchor), maxY);
    }

    popup.setLatLng(map.containerPointToLatLng(adjustedAnchor));
}

export interface FeatureHoverPopupController {
    set(popup: L.Popup): void;
    close(popup: L.Popup): void;
    scheduleClose(): void;
}

export function createFeatureHoverPopupController(): FeatureHoverPopupController {
    let activePopup: L.Popup | null = null;

    const close = (popup: L.Popup): void => {
        if (activePopup !== popup) {
            return;
        }

        popup.remove();
        activePopup = null;
    };

    return {
        set(popup) {
            activePopup = popup;
        },
        close,
        scheduleClose() {
            const popup = activePopup;
            if (!popup) {
                return;
            }

            window.setTimeout(() => {
                if (activePopup === popup && !popup.getElement()?.matches(':hover')) {
                    close(popup);
                }
            }, 0);
        }
    };
}

export function getFeatureHoverLatLng(
    map: L.Map,
    featureCenter: L.LatLng,
    initialHoverLatLng: L.LatLng
): L.LatLng {
    return map.getBounds().contains(featureCenter) ? featureCenter : initialHoverLatLng;
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
