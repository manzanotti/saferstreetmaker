/**
 * layerUtils.ts
 *
 * Shared helpers for layer composables (cursor, toolbar button, legend entry,
 * and popup builders). Hover, group-membership, and action popup behavior
 * live in focused modules and are re-exported here for existing layer callers.
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
import { buildPopupActionControl } from './featureActionPopup';

export {
    buildPopupActionControl,
    setFeatureActionPopupContent,
    buildFeatureActionPopup
} from './featureActionPopup';
export type { FeatureActionPopupOptions } from './featureActionPopup';

export {
    buildFeatureGroupMembershipContent,
    disposePopupElement
} from './featureGroupMembershipPopup';

export {
    addFeatureHoverPopup,
    createFeatureHoverPopupController,
    getFeatureHoverLatLng,
    closeFeatureHoverPopups
} from './featureHoverPopups';
export type { FeatureHoverPopupController } from './featureHoverPopups';

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
    'bus-lane',
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
