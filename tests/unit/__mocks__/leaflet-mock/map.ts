/**
 * Leaflet mock map, controls, DOM utilities and the leaflet.draw namespace.
 */
import { vi } from 'vitest';
import { LatLng, LatLngBounds } from './geometry';

const DomEvent = {
    stopPropagation: vi.fn(),
    disableClickPropagation: vi.fn(),
    disableScrollPropagation: vi.fn()
};

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
    dragging = {
        disable: vi.fn(),
        enable: vi.fn()
    };
    private readonly _container = document.createElement('div');

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
    fire(event: string, payload?: Record<string, unknown>) {
        for (const handler of this._handlers[event] ?? []) {
            handler({ target: this, ...payload });
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
    getContainer() {
        return this._container;
    }
    getZoom() {
        return 10;
    }
    getMaxZoom() {
        return 18;
    }
    getCenter() {
        return new LatLng(0, 0);
    }
    getBounds() {
        // Whole-world bounds so viewport.contains() is always true in unit
        // tests and undo/redo area reveal never needs to move the mock map.
        return new LatLngBounds([new LatLng(-90, -180), new LatLng(90, 180)]);
    }
    setView(_center: any, _zoom?: any) {
        return this;
    }
    panTo(_center: any, _opts?: any) {
        return this;
    }
    fitBounds(_bounds: any, _opts?: any) {
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

export { DomEvent, Draw, Map, TileLayer, Control, DomUtil };
