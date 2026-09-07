/**
 * cursorUtils.ts
 *
 * Cursor-related DOM helpers for layer composables.
 * Extracted from layerUtils.ts — pure mechanical split, no behavior changes.
 */

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
