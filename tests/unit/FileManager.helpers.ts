/**
 * Shared layer, settings and legacy-storage fixtures for the FileManager unit tests.
 */
import LZString from 'lz-string';
import { vi } from 'vitest';
import { Settings } from '../../src/models/Settings';
import { IMapLayer } from '../../src/composables/layers/IMapLayer';

// --------------------------------------------------------------------------
// Helper – build a minimal IMapLayer stub whose toGeoJSON returns a
// FeatureCollection with the supplied features.
// --------------------------------------------------------------------------
export function makeLayer(id: string, features: any[] = []): IMapLayer {
    return {
        id,
        title: id,
        selected: false,
        visible: false,
        groupName: '',
        iconHtml: '',
        getToolbarButton: vi.fn(),
        getLegendEntry: vi.fn(),
        loadFromGeoJSON: vi.fn(),
        getLayer: vi.fn(),
        toGeoJSON: () => ({ type: 'FeatureCollection', features }),
        clearLayer: vi.fn()
    };
}

export function makeSettings(title = 'Test Map'): Settings {
    const s = new Settings();
    s.title = title;
    return s;
}

export function seedLegacyLocalStorageMap(title: string, version: string): void {
    const data = {
        settings: {
            title,
            readOnly: false,
            hideToolbar: false,
            activeLayers: [],
            centre: null,
            zoom: 12,
            version
        },
        layers: {},
        lastSaved: '2026-06-22T00:00:00.000Z'
    };

    localStorage.setItem(`Map_${title}`, LZString.compress(JSON.stringify(data)));
    localStorage.setItem('MapList', LZString.compress(JSON.stringify([title])));
    localStorage.setItem('LastMapSelected', LZString.compress(title));
}

export function seedLegacyLocalStorageMapWithoutVersion(title: string): void {
    const data = {
        settings: {
            title,
            readOnly: false,
            hideToolbar: false,
            activeLayers: [],
            centre: null,
            zoom: 12
        },
        layers: {},
        lastSaved: '2026-06-22T00:00:00.000Z'
    };

    localStorage.setItem(`Map_${title}`, LZString.compress(JSON.stringify(data)));
    localStorage.setItem('MapList', LZString.compress(JSON.stringify([title])));
    localStorage.setItem('LastMapSelected', LZString.compress(title));
}

export function seedLegacyLocalStorageMapWithoutSettings(title: string): void {
    const data = {
        title,
        centre: { lat: 52.5, lng: -1.9 },
        zoom: 12,
        layers: {
            ModalFilters: { type: 'FeatureCollection', features: [] }
        },
        lastSaved: '2026-06-22T00:00:00.000Z'
    };

    localStorage.setItem(`Map_${title}`, LZString.compress(JSON.stringify(data)));
    localStorage.setItem('MapList', LZString.compress(JSON.stringify([title])));
    localStorage.setItem('LastMapSelected', LZString.compress(title));
}
