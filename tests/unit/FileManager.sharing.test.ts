/**
 * Unit tests for FileManager — group persistence, share hashes and map copies.
 */
import Dexie from 'dexie';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FileManager } from '../../src/services/FileManager';
import { IMapLayer } from '../../src/composables/layers/IMapLayer';
import { makeLayer, makeSettings } from './FileManager.helpers';

// --------------------------------------------------------------------------
// Leaflet LatLng stub (needed by Settings default)
// --------------------------------------------------------------------------
vi.mock('leaflet', () => ({
    LatLng: class {
        lat: number;
        lng: number;
        constructor(lat: number, lng: number) {
            this.lat = lat;
            this.lng = lng;
        }
    }
}));

describe('FileManager', () => {
    let fm: FileManager;

    beforeEach(async () => {
        await Dexie.delete('SaferStreetMakerDB');
        localStorage.clear();
        document.body.innerHTML = '';
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        fm = new FileManager();
    });

    afterEach(async () => {
        await Dexie.delete('SaferStreetMakerDB');
    });

    // -----------------------------------------------------------------------
    // saveMap / loadMapFromStorage
    // -----------------------------------------------------------------------
    describe('saveMap / loadMapFromStorage', () => {
        it('persists and restores element groups through storage', async () => {
            const settings = makeSettings('GroupCity');
            const layers = new Map<string, IMapLayer>([
                ['ModalFilters', makeLayer('ModalFilters')]
            ]);
            const groups = [
                {
                    id: 'g1',
                    name: 'Zone',
                    members: [{ layerId: 'ModalFilters', historyId: 'h1' }]
                }
            ];

            await fm.saveMap(settings, layers, groups);

            const loaded = await fm.loadMapFromStorage('GroupCity');
            expect(loaded?.groups).toHaveLength(1);
            expect(loaded?.groups?.[0]).toEqual(groups[0]);
        });

        it('round-trips groups through the share hash', () => {
            const settings = makeSettings('HashCity');
            const groups = [{ id: 'g1', name: 'Zone', members: [] }];

            const hash = fm.saveMapToHash(settings, new Map(), groups);
            const restored = fm.loadMapFromHash(hash);
            expect(restored?.groups).toHaveLength(1);
            expect(restored?.groups?.[0].name).toBe('Zone');
        });
    });

    // -----------------------------------------------------------------------
    // saveMapToHash / loadMapFromHash
    // -----------------------------------------------------------------------
    describe('saveMapToHash / loadMapFromHash', () => {
        it('round-trips a map through a URI-encoded hash', () => {
            const settings = makeSettings('HashCity');
            const layers = new Map<string, IMapLayer>([
                ['ModalFilters', makeLayer('ModalFilters')]
            ]);

            const hash = fm.saveMapToHash(settings, layers);
            expect(typeof hash).toBe('string');
            expect(hash.length).toBeGreaterThan(0);

            const loaded = fm.loadMapFromHash(hash);
            expect(loaded?.settings?.title).toBe('HashCity');
        });

        it('loadMapFromHash handles plain JSON strings (legacy %prefixed)', () => {
            const data = { settings: { title: 'Legacy' }, layers: {} };
            const encoded = encodeURIComponent(JSON.stringify(data));
            const loaded = fm.loadMapFromHash(encoded);
            expect(loaded?.settings?.title).toBe('Legacy');
        });

        it('round-trip: hash produced by saveMapToHash is loadable', () => {
            const settings = makeSettings('HashCity2');
            const hash = fm.saveMapToHash(settings, new Map());
            // Non-% string → LZString branch
            expect(hash.startsWith('%')).toBe(false);
            const loaded = fm.loadMapFromHash(hash);
            expect(loaded?.settings?.title).toBe('HashCity2');
        });
    });

    // -----------------------------------------------------------------------
    // copyMap
    // -----------------------------------------------------------------------
    describe('copyMap', () => {
        it('saves a copy with _copy_1 suffix', async () => {
            const settings = makeSettings('Original');
            await fm.saveMap(settings, new Map());

            const settingsCopy = makeSettings('Original');
            await fm.copyMap(settingsCopy, new Map());

            await expect(fm.loadMapFromStorage('Original_copy_1')).resolves.not.toBeNull();
        });

        it('increments the copy index so each copy gets a unique name', async () => {
            await fm.saveMap(makeSettings('City'), new Map());

            const c1 = makeSettings('City');
            await fm.copyMap(c1, new Map());

            const c2 = makeSettings('City');
            await fm.copyMap(c2, new Map());

            await expect(fm.loadMapFromStorage('City_copy_1')).resolves.not.toBeNull();
            await expect(fm.loadMapFromStorage('City_copy_2')).resolves.not.toBeNull();
        });

        it('mutates settings.title to the new copy name', async () => {
            await fm.saveMap(makeSettings('Town'), new Map());
            const settings = makeSettings('Town');
            await fm.copyMap(settings, new Map());
            expect(settings.title).toBe('Town_copy_1');
        });
    });
});
