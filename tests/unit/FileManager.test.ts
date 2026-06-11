import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FileManager } from '../../src/scripts/FileManager';
import { Settings } from '../../src/scripts/Settings';
import { IMapLayer } from '../../src/scripts/layers/IMapLayer';

// --------------------------------------------------------------------------
// Leaflet LatLng stub (needed by Settings default)
// --------------------------------------------------------------------------
vi.mock('leaflet', () => ({
    LatLng: class {
        lat: number; lng: number;
        constructor(lat: number, lng: number) { this.lat = lat; this.lng = lng; }
    },
}));

// --------------------------------------------------------------------------
// Helper – build a minimal IMapLayer stub whose toGeoJSON returns a
// FeatureCollection with the supplied features.
// --------------------------------------------------------------------------
function makeLayer(id: string, features: any[] = []): IMapLayer {
    return {
        id,
        title: id,
        selected: false,
        visible: false,
        groupName: '',
        getToolbarButton: vi.fn(),
        getLegendEntry: vi.fn(),
        loadFromGeoJSON: vi.fn(),
        getLayer: vi.fn(),
        toGeoJSON: () => ({ type: 'FeatureCollection', features }),
        clearLayer: vi.fn(),
    };
}

function makeSettings(title = 'Test Map'): Settings {
    const s = new Settings();
    s.title = title;
    return s;
}

// --------------------------------------------------------------------------
describe('FileManager', () => {
    let fm: FileManager;

    beforeEach(() => {
        fm = new FileManager();
        localStorage.clear();
    });

    // -----------------------------------------------------------------------
    // saveLastMapSelected / loadLastMapSelected
    // -----------------------------------------------------------------------
    describe('saveLastMapSelected / loadLastMapSelected', () => {
        it('saves and retrieves the last map name', () => {
            fm.saveLastMapSelected('My City');
            expect(fm.loadLastMapSelected()).toBe('My City');
        });

        it('returns empty string when nothing saved', () => {
            expect(fm.loadLastMapSelected()).toBe('');
        });

        it('overwrites the previous value', () => {
            fm.saveLastMapSelected('First');
            fm.saveLastMapSelected('Second');
            expect(fm.loadLastMapSelected()).toBe('Second');
        });
    });

    // -----------------------------------------------------------------------
    // saveMapList / loadMapListFromStorage
    // -----------------------------------------------------------------------
    describe('saveMapList / loadMapListFromStorage', () => {
        it('returns empty array when nothing stored', () => {
            expect(fm.loadMapListFromStorage()).toEqual([]);
        });

        it('adds a new map title', () => {
            fm.saveMapList('Alpha');
            expect(fm.loadMapListFromStorage()).toContain('Alpha');
        });

        it('prepends the newest title (most-recent first)', () => {
            fm.saveMapList('Alpha');
            fm.saveMapList('Beta');
            const list = fm.loadMapListFromStorage();
            expect(list[0]).toBe('Beta');
            expect(list[1]).toBe('Alpha');
        });

        it('de-duplicates: moves existing title to the front', () => {
            fm.saveMapList('Alpha');
            fm.saveMapList('Beta');
            fm.saveMapList('Alpha');
            const list = fm.loadMapListFromStorage();
            expect(list[0]).toBe('Alpha');
            expect(list.filter(t => t === 'Alpha')).toHaveLength(1);
        });
    });

    // -----------------------------------------------------------------------
    // saveMap / loadMapFromStorage
    // -----------------------------------------------------------------------
    describe('saveMap / loadMapFromStorage', () => {
        it('persists a map and retrieves it', () => {
            const settings = makeSettings('Birmingham');
            const layers = new Map<string, IMapLayer>([
                ['ModalFilters', makeLayer('ModalFilters')],
            ]);

            fm.saveMap(settings, layers);

            const loaded = fm.loadMapFromStorage('Birmingham');
            expect(loaded).not.toBeNull();
            expect(loaded.settings.title).toBe('Birmingham');
        });

        it('returns null when map does not exist', () => {
            expect(fm.loadMapFromStorage('NonExistent')).toBeNull();
        });

        it('saves layers correctly into the stored data', () => {
            const feature = { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: {} };
            const settings = makeSettings('CityTest');
            const layers = new Map<string, IMapLayer>([
                ['ModalFilters', makeLayer('ModalFilters', [feature])],
            ]);

            fm.saveMap(settings, layers);

            const loaded = fm.loadMapFromStorage('CityTest');
            expect(loaded.layers.ModalFilters.features).toHaveLength(1);
        });

        it('includes a lastSaved timestamp', () => {
            const settings = makeSettings('TimestampCity');
            fm.saveMap(settings, new Map());
            const loaded = fm.loadMapFromStorage('TimestampCity');
            expect(loaded.lastSaved).toBeTruthy();
            expect(new Date(loaded.lastSaved).toString()).not.toBe('Invalid Date');
        });

        it('adds the title to the map list', () => {
            const settings = makeSettings('ListedCity');
            fm.saveMap(settings, new Map());
            expect(fm.loadMapListFromStorage()).toContain('ListedCity');
        });

        it('sets the last map selected', () => {
            const settings = makeSettings('LastCity');
            fm.saveMap(settings, new Map());
            expect(fm.loadLastMapSelected()).toBe('LastCity');
        });
    });

    // -----------------------------------------------------------------------
    // deleteMapFromStorage
    // -----------------------------------------------------------------------
    describe('deleteMapFromStorage', () => {
        it('removes the map from storage', () => {
            const settings = makeSettings('DeleteMe');
            fm.saveMap(settings, new Map());
            fm.deleteMapFromStorage('DeleteMe');
            expect(fm.loadMapFromStorage('DeleteMe')).toBeNull();
        });

        it('removes the title from the map list', () => {
            const settings = makeSettings('RemoveFromList');
            fm.saveMap(settings, new Map());
            fm.deleteMapFromStorage('RemoveFromList');
            expect(fm.loadMapListFromStorage()).not.toContain('RemoveFromList');
        });

        it('does not throw when deleting a non-existent map', () => {
            expect(() => fm.deleteMapFromStorage('Ghost')).not.toThrow();
        });

        it('leaves other maps intact', () => {
            fm.saveMap(makeSettings('Keep'), new Map());
            fm.saveMap(makeSettings('Delete'), new Map());
            fm.deleteMapFromStorage('Delete');
            expect(fm.loadMapFromStorage('Keep')).not.toBeNull();
        });
    });

    // -----------------------------------------------------------------------
    // saveMapToHash / loadMapFromHash
    // -----------------------------------------------------------------------
    describe('saveMapToHash / loadMapFromHash', () => {
        it('round-trips a map through a URI-encoded hash', () => {
            const settings = makeSettings('HashCity');
            const layers = new Map<string, IMapLayer>([
                ['ModalFilters', makeLayer('ModalFilters')],
            ]);

            const hash = fm.saveMapToHash(settings, layers);
            expect(typeof hash).toBe('string');
            expect(hash.length).toBeGreaterThan(0);

            const loaded = fm.loadMapFromHash(hash);
            expect(loaded.settings.title).toBe('HashCity');
        });

        it('loadMapFromHash handles plain JSON strings (legacy %prefixed)', () => {
            const data = { settings: { title: 'Legacy' }, layers: {} };
            const encoded = encodeURIComponent(JSON.stringify(data));
            const loaded = fm.loadMapFromHash(encoded);
            expect(loaded.settings.title).toBe('Legacy');
        });

        it('round-trip: hash produced by saveMapToHash is loadable', () => {
            const settings = makeSettings('HashCity2');
            const hash = fm.saveMapToHash(settings, new Map());
            // Non-% string → LZString branch
            expect(hash.startsWith('%')).toBe(false);
            const loaded = fm.loadMapFromHash(hash);
            expect(loaded.settings.title).toBe('HashCity2');
        });
    });

    // -----------------------------------------------------------------------
    // copyMap
    // -----------------------------------------------------------------------
    describe('copyMap', () => {
        it('saves a copy with _copy_1 suffix', () => {
            const settings = makeSettings('Original');
            fm.saveMap(settings, new Map());

            const settingsCopy = makeSettings('Original');
            fm.copyMap(settingsCopy, new Map());

            expect(fm.loadMapFromStorage('Original_copy_1')).not.toBeNull();
        });

        it('increments the copy index so each copy gets a unique name', () => {
            fm.saveMap(makeSettings('City'), new Map());

            const c1 = makeSettings('City');
            fm.copyMap(c1, new Map());

            const c2 = makeSettings('City');
            fm.copyMap(c2, new Map());

            expect(fm.loadMapFromStorage('City_copy_1')).not.toBeNull();
            expect(fm.loadMapFromStorage('City_copy_2')).not.toBeNull();
        });

        it('mutates settings.title to the new copy name', () => {
            fm.saveMap(makeSettings('Town'), new Map());
            const settings = makeSettings('Town');
            fm.copyMap(settings, new Map());
            expect(settings.title).toBe('Town_copy_1');
        });
    });
});
