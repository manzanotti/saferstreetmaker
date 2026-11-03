/**
 * Leaflet mock vector layers: CircleMarker, Polyline and Polygon.
 */
import { LatLng, LatLngBounds } from './geometry';

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

    getBounds() {
        return new LatLngBounds(this.latlngs);
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

    bindTooltip(_content: any, _opts?: any) {
        return this;
    }
    openTooltip() {
        return this;
    }
    closeTooltip() {
        return this;
    }
    setStyle(style: any) {
        Object.assign(this.options, style);
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

export { CircleMarker, Polyline, Polygon };
