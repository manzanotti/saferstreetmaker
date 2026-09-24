/**
 * layerUtils.ts
 *
 * Shared helpers for layer composables (cursor, toolbar button, legend entry,
 * and group popup builders). Hover, group-membership, action, and description popup behavior
 * live in focused modules and are re-exported here for existing layer callers.
 * Extracted from LayerHelpers.ts — PubSub removed entirely.
 *
 * Note on DOM usage: popup builders and `buildLegendEntry` use
 * `document.createElement` to construct HTML for Leaflet popups and the legacy
 * `getLegendEntry()` interface method. This is intentional — Leaflet manages
 * those DOM subtrees directly and they live outside Vue's virtual DOM.
 * Do not replace these with Vue components; keep the boundary here.
 */
import * as L from 'leaflet';
import { ToolbarButton } from '../../models/ToolbarButton';
import { findFeatureGroupMemberships } from '../../features/groups/featureMemberships';
import { getActiveVersion } from '../../features/groups/groupVersions';
import { useGroupStore } from '../../stores/groupStore';
import { useMapStore } from '../../stores/mapStore';
import { pinia } from '../../stores/index';
import type { GroupMember } from '../../models/Group';
import { findLayerFeatureByHistoryId } from './featureLookup';

export { getFeatureHistoryId, findLayerFeatureByHistoryId } from './featureLookup';
export {
    buildPopupActionControl,
    buildDeletePopup,
    setFeatureActionPopupContent,
    buildFeatureActionPopup
} from './featureActionPopup';
export type { FeatureActionPopupOptions } from './featureActionPopup';

export { buildReadOnlyGroupPopup } from './readOnlyGroupPopup';

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

export { buildFeatureDescriptionPopup } from './featureDescriptionPopup';
export type { FeatureDescriptionPopupDetails } from './featureDescriptionPopup';

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
