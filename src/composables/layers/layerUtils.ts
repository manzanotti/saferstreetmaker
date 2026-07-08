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

const POINT_FEATURE_CLASSES = [
    'modal-filter-marker',
    'bus-gate-icon',
    'traffic-lights-icon',
    'pedestrian-lights-icon',
    'zebra-crossing-icon'
];

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

    const activate = () => {
        onActivate();
    };

    control.addEventListener('click', activate);

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
