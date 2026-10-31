/**
 * Leaflet mock layer containers, markers, factories and popups.
 */
import { vi } from 'vitest';
import { LatLng, LatLngBounds } from './geometry';

class GeoJSON {
    private _layers: any[] = [];
    private _handlers: Record<string, Function[]> = {};
    options: any;

    constructor(_data?: any, options?: any) {
        this.options = options ?? {};
    }

    on(event: string, fn: Function) {
        (this._handlers[event] ??= []).push(fn);
        return this;
    }

    off(event?: string, fn?: Function) {
        if (!event) {
            this._handlers = {};
        } else if (!fn) {
            delete this._handlers[event];
        } else {
            this._handlers[event] = (this._handlers[event] ?? []).filter(
                (handler) => handler !== fn
            );
        }
        return this;
    }
    fire(event: string, payload?: Record<string, unknown>) {
        for (const handler of this._handlers[event] ?? []) {
            handler({ target: this, ...payload });
        }
        return this;
    }

    addLayer(layer: any) {
        this._layers.push(layer);
    }
    removeLayer(layer: any) {
        this._layers = this._layers.filter((l) => l !== layer);
        this.fire('layerremove', { layer });
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

function rectangle(_bounds: LatLngBounds, _options?: any) {
    return {
        addTo(_map: any) {
            return this;
        },
        setBounds: vi.fn().mockReturnThis(),
        remove: vi.fn().mockReturnThis()
    };
}

function popup(options?: any) {
    const handlers: Record<string, Function[]> = {};
    return {
        options,
        _latlng: null as any,
        on(event: string, fn: Function) {
            (handlers[event] ??= []).push(fn);
            return this;
        },
        fire(event: string) {
            for (const handler of handlers[event] ?? []) {
                handler();
            }
            return this;
        },
        addTo: vi.fn().mockReturnThis(),
        getElement: () => null,
        remove: vi.fn(),
        setContent: vi.fn().mockReturnThis(),
        setLatLng: vi.fn().mockReturnThis()
    };
}

export { GeoJSON, DivIcon, Marker, geoJSON, layerGroup, circleMarker, rectangle, popup };
