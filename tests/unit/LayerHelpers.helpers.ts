/**
 * Shared DOM element factories for the layer helper unit tests.
 */

export function makeMapEl() {
    const el = document.createElement('div');
    el.id = 'map';
    el.classList.add('leaflet-grab');
    document.body.appendChild(el);
    return el;
}

export function getMapEl() {
    return document.getElementById('map')!;
}

export function makeMouseMarkerEl() {
    const el = document.createElement('div');
    el.classList.add('leaflet-mouse-marker');
    document.body.appendChild(el);
    return el;
}
