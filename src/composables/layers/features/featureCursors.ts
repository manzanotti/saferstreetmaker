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
