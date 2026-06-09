/**
 * Shared Leaflet mock for unit tests.
 * Import this file's path in vi.mock() calls.
 *
 * Usage in a test file:
 *   vi.mock('leaflet', () => import('../__mocks__/leaflet'));
 */
import { vi } from 'vitest';

class LatLng {
    constructor(public lat: number, public lng: number) {}
}

class GeoJSON {
    private _layers: any[] = [];
    options: any;

    constructor(_data?: any, options?: any) {
        this.options = options ?? {};
    }

    addLayer(layer: any) { this._layers.push(layer); }
    removeLayer(layer: any) { this._layers = this._layers.filter(l => l !== layer); }
    clearLayers() { this._layers = []; }
    getLayers() { return this._layers; }
    toGeoJSON() { return { type: 'FeatureCollection', features: [] }; }
    eachLayer(fn: (l: any) => void) { this._layers.forEach(fn); }
}

class CircleMarker {
    options: any;
    private _handlers: Record<string, Function[]> = {};
    properties: any = {};

    constructor(public latlng: LatLng, options?: any) {
        this.options = options ?? {};
    }

    on(event: string, fn: Function) {
        (this._handlers[event] ??= []).push(fn);
        return this;
    }

    toGeoJSON() {
        return {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [this.latlng.lng, this.latlng.lat] },
            properties: this.properties,
        };
    }
}

class Polyline {
    properties: any = {};
    private _handlers: Record<string, Function[]> = {};

    constructor(public latlngs: LatLng[], public options: any = {}) {}

    on(event: string, fn: Function) {
        (this._handlers[event] ??= []).push(fn);
        return this;
    }

    /** leaflet-arrowheads extension used by OneWayStreetLayer */
    arrowheads(_opts?: any) { return this; }

    toGeoJSON() {
        return {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: this.latlngs.map(p => [p.lng, p.lat]) },
            properties: this.properties,
        };
    }
}

class Polygon {
    properties: any = {};
    options: any;
    private _handlers: Record<string, Function[]> = {};

    constructor(public latlngs: LatLng[], options: any = {}) {
        this.options = options;
    }

    on(event: string, fn: Function) {
        (this._handlers[event] ??= []).push(fn);
        return this;
    }

    bindTooltip(_content: any, _opts?: any) { return this; }
    openTooltip() { return this; }
    closeTooltip() { return this; }
    setTooltipContent(_content: any) { return this; }
    getBounds() { return { getCenter: () => new LatLng(0, 0) }; }

    toGeoJSON() {
        return {
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [this.latlngs.map(p => [p.lng, p.lat])] },
            properties: { ...this.properties },
        };
    }
}

class DivIcon {
    constructor(public options: any = {}) {}
}

class Marker {
    options: any;
    private _handlers: Record<string, Function[]> = {};

    constructor(public latlng: LatLng, options?: any) {
        this.options = options ?? {};
    }

    on(event: string, fn: Function) {
        (this._handlers[event] ??= []).push(fn);
        return this;
    }

    toGeoJSON() {
        return {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [this.latlng.lng, this.latlng.lat] },
            properties: {},
        };
    }
}

const DomEvent = {
    stopPropagation: vi.fn(),
};

function geoJSON(data?: any, options?: any) {
    return new GeoJSON(data, options);
}

class Point {
    constructor(public x: number, public y: number) {}
}

function popup(options?: any) {
    return {
        options,
        _latlng: null as any,
        setContent: vi.fn().mockReturnThis(),
        setLatLng: vi.fn().mockReturnThis(),
    };
}

// Draw namespace stub
const Draw = {
    Polyline: class {
        constructor(_map: any, _opts?: any) {}
        enable() {}
        disable() {}
    },
};

export {
    LatLng,
    GeoJSON,
    geoJSON,
    CircleMarker,
    Marker,
    Polyline,
    Polygon,
    DivIcon,
    DomEvent,
    Draw,
    Point,
    popup,
};
