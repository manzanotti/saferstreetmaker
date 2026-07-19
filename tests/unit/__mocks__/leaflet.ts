/**
 * Shared Leaflet mock for unit tests.
 * Import this file's path in vi.mock() calls.
 *
 * Usage in a test file:
 *   vi.mock('leaflet', () => import('../__mocks__/leaflet'));
 */
import { vi } from 'vitest';

class LatLng {
    constructor(
        public lat: number,
        public lng: number
    ) {}
}

class GeoJSON {
    private _layers: any[] = [];
    options: any;

    constructor(_data?: any, options?: any) {
        this.options = options ?? {};
    }

    addLayer(layer: any) {
        this._layers.push(layer);
    }
    removeLayer(layer: any) {
        this._layers = this._layers.filter((l) => l !== layer);
    }
    clearLayers() {
        this._layers = [];
    }
    getLayers() {
        return this._layers;
    }
    toGeoJSON() {
        return { type: 'FeatureCollection', features: [] };
    }
    eachLayer(fn: (l: any) => void) {
        this._layers.forEach(fn);
    }
}

class CircleMarker {
    options: any;
    private _handlers: Record<string, Function[]> = {};
    properties: any = {};

    constructor(
        public latlng: LatLng,
        options?: any
    ) {
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
            properties: this.properties
        };
    }
}

class Polyline {
    properties: any = {};
    private _handlers: Record<string, Function[]> = {};

    constructor(
        public latlngs: LatLng[],
        public options: any = {}
    ) {}

    on(event: string, fn: Function) {
        (this._handlers[event] ??= []).push(fn);
        return this;
    }

    fire(event: string, payload?: Record<string, unknown>) {
        for (const handler of this._handlers[event] ?? []) {
            handler({ target: this, ...payload });
        }
        return this;
    }

    getLatLngs() {
        return this.latlngs;
    }

    /** leaflet-arrowheads extension used by OneWayStreetLayer */
    arrowheads(_opts?: any) {
        return this;
    }

    toGeoJSON() {
        return {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: this.latlngs.map((p) => [p.lng, p.lat]) },
            properties: this.properties
        };
    }
}

class Polygon {
    properties: any = {};
    options: any;
    private _handlers: Record<string, Function[]> = {};

    constructor(
        public latlngs: LatLng[],
        options: any = {}
    ) {
        this.options = options;
    }

    on(event: string, fn: Function) {
        (this._handlers[event] ??= []).push(fn);
        return this;
    }

    fire(event: string, payload?: Record<string, unknown>) {
        for (const handler of this._handlers[event] ?? []) {
            handler({ target: this, ...payload });
        }
        return this;
    }

    bindTooltip(_content: any, _opts?: any) {
        return this;
    }
    openTooltip() {
        return this;
    }
    closeTooltip() {
        return this;
    }
    setTooltipContent(_content: any) {
        return this;
    }
    getBounds() {
        return { getCenter: () => new LatLng(0, 0) };
    }

    getLatLngs() {
        return [this.latlngs];
    }

    toGeoJSON() {
        return {
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [this.latlngs.map((p) => [p.lng, p.lat])] },
            properties: { ...this.properties }
        };
    }
}

class DivIcon {
    constructor(public options: any = {}) {}
}

class Marker {
    options: any;
    private _handlers: Record<string, Function[]> = {};

    constructor(
        public latlng: LatLng,
        options?: any
    ) {
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
            properties: {}
        };
    }
}

const DomEvent = {
    stopPropagation: vi.fn(),
    disableClickPropagation: vi.fn(),
    disableScrollPropagation: vi.fn()
};

function geoJSON(data?: any, options?: any) {
    return new GeoJSON(data, options);
}

function layerGroup() {
    return {
        addTo(_map: any) {
            return this;
        },
        clearLayers() {
            return this;
        },
        remove() {
            return this;
        }
    };
}

function circleMarker(_latlng: LatLng, _options?: any) {
    return {
        addTo(_layer: any) {
            return this;
        }
    };
}

class Point {
    constructor(
        public x: number,
        public y: number
    ) {}
}

function popup(options?: any) {
    return {
        options,
        _latlng: null as any,
        setContent: vi.fn().mockReturnThis(),
        setLatLng: vi.fn().mockReturnThis()
    };
}

// Draw namespace stub
const Draw = {
    Polyline: class {
        constructor(_map: any, _opts?: any) {}
        enable() {}
        disable() {}
    },
    Polygon: class {
        constructor(_map: any, _opts?: any) {}
        enable() {}
        disable() {}
    }
};

class Map {
    private _handlers: Record<string, Function[]> = {};

    constructor(_el?: any, _opts?: any) {}

    on(event: string, fn: Function) {
        (this._handlers[event] ??= []).push(fn);
        return this;
    }
    off(event: string, fn: Function) {
        if (this._handlers[event]) {
            this._handlers[event] = this._handlers[event].filter((f) => f !== fn);
        }
        return this;
    }
    addLayer(_layer: any) {
        return this;
    }
    removeLayer(_layer: any) {
        return this;
    }
    openPopup(_popup: any) {
        return this;
    }
    closePopup(_popup?: any) {
        return this;
    }
    getZoom() {
        return 10;
    }
    getCenter() {
        return new LatLng(0, 0);
    }
    setView(_center: any, _zoom?: any) {
        return this;
    }
    createPane(_name: string) {
        return { style: {} };
    }
}

class TileLayer {
    constructor(_url: string, _opts?: any) {}
    addTo(_map: any) {
        return this;
    }
}

class Control {
    options: any;
    onAdd?: () => HTMLElement;
    onRemove?: () => void;

    constructor(options?: any) {
        this.options = options ?? {};
    }
}

const DomUtil = {
    create: (_tagName: string) => document.createElement('div')
};

export {
    LatLng,
    GeoJSON,
    geoJSON,
    layerGroup,
    circleMarker,
    CircleMarker,
    Marker,
    Polyline,
    Polygon,
    DivIcon,
    DomEvent,
    Draw,
    Map,
    TileLayer,
    Control,
    DomUtil,
    Point,
    popup
};
