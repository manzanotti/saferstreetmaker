/**
 * Unit tests for FileManager — saving and loading maps from storage.
 */
import Dexie from 'dexie';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FileManager } from '../../src/services/FileManager';
import { IMapLayer } from '../../src/composables/layers/IMapLayer';
import type { ImportedGeoJsonLayer } from '../../src/models/ImportedGeoJsonLayer';
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
    // saveLastMapSelected / loadLastMapSelected
    // -----------------------------------------------------------------------
    describe('saveLastMapSelected / loadLastMapSelected', () => {
        it('saves and retrieves the last map name', async () => {
            await fm.saveLastMapSelected('My City');
            await expect(fm.loadLastMapSelected()).resolves.toBe('My City');
        });

        it('returns empty string when nothing saved', async () => {
            await expect(fm.loadLastMapSelected()).resolves.toBe('');
        });

        it('overwrites the previous value', async () => {
            await fm.saveLastMapSelected('First');
            await fm.saveLastMapSelected('Second');
            await expect(fm.loadLastMapSelected()).resolves.toBe('Second');
        });
    });

    // -----------------------------------------------------------------------
    // loadMapListFromStorage
    // -----------------------------------------------------------------------
    describe('loadMapListFromStorage', () => {
        it('returns empty array when nothing stored', async () => {
            await expect(fm.loadMapListFromStorage()).resolves.toEqual([]);
        });

        it('prepends the newest saved title (most-recent first)', async () => {
            await fm.saveMap(makeSettings('Alpha'), new Map());
            await fm.saveMap(makeSettings('Beta'), new Map());
            const list = await fm.loadMapListFromStorage();
            expect(list[0]).toBe('Beta');
            expect(list[1]).toBe('Alpha');
        });

        it('moves an existing map title back to the front when resaved', async () => {
            await fm.saveMap(makeSettings('Alpha'), new Map());
            await fm.saveMap(makeSettings('Beta'), new Map());
            await fm.saveMap(makeSettings('Alpha'), new Map());
            const list = await fm.loadMapListFromStorage();
            expect(list[0]).toBe('Alpha');
            expect(list.filter((t) => t === 'Alpha')).toHaveLength(1);
        });
    });

    // -----------------------------------------------------------------------
    // saveMap / loadMapFromStorage
    // -----------------------------------------------------------------------
    describe('saveMap / loadMapFromStorage', () => {
        it('persists a map and retrieves it', async () => {
            const settings = makeSettings('Birmingham');
            const layers = new Map<string, IMapLayer>([
                ['ModalFilters', makeLayer('ModalFilters')]
            ]);

            await fm.saveMap(settings, layers);

            const loaded = await fm.loadMapFromStorage('Birmingham');
            expect(loaded).not.toBeNull();
            expect(loaded?.settings?.title).toBe('Birmingham');
        });

        it('returns null when map does not exist', async () => {
            await expect(fm.loadMapFromStorage('NonExistent')).resolves.toBeNull();
        });

        it('saves layers correctly into the stored data', async () => {
            const feature = {
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [0, 0] },
                properties: {}
            };
            const settings = makeSettings('CityTest');
            const layers = new Map<string, IMapLayer>([
                ['ModalFilters', makeLayer('ModalFilters', [feature])]
            ]);

            await fm.saveMap(settings, layers);

            const loaded = await fm.loadMapFromStorage('CityTest');
            expect((loaded?.layers as any).ModalFilters.features).toHaveLength(1);
        });

        it('saves an existing snapshot without serializing layers twice', async () => {
            const settings = makeSettings('SnapshotCity');
            const layer = makeLayer('ModalFilters', [
                {
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: [-1.9, 52.5] },
                    properties: { historyId: 'point-1' }
                }
            ]);
            const layers = new Map([['ModalFilters', layer]]);
            const groups = [
                {
                    id: 'g1',
                    name: 'Zone',
                    members: [{ layerId: 'ModalFilters', historyId: 'point-1' }]
                }
            ];
            const importedLayers: ImportedGeoJsonLayer[] = [
                {
                    id: 'wards',
                    name: 'Wards',
                    nameProperty: 'name',
                    visible: false,
                    featureCollection: { type: 'FeatureCollection', features: [] }
                }
            ];
            const toGeoJSON = vi.spyOn(layer, 'toGeoJSON');
            const snapshot = fm.buildSerializedMap(settings, layers, groups, importedLayers);
            expect(toGeoJSON).toHaveBeenCalledOnce();
            toGeoJSON.mockImplementation(() => {
                throw new Error('Layer was serialized again');
            });

            await fm.saveMap(settings, layers, groups, importedLayers, snapshot);

            expect(toGeoJSON).toHaveBeenCalledOnce();
            expect(await fm.loadMapFromStorage('SnapshotCity')).toEqual(snapshot);
            expect((await fm.loadRawMapFromStorage('SnapshotCity'))?.updatedAt).toBe(
                snapshot.lastSaved
            );
        });

        it('loads the raw stored record without deserialising it', async () => {
            const settings = makeSettings('RawCity');
            await fm.saveMap(settings, new Map());

            const rawRecord = await fm.loadRawMapFromStorage('RawCity');
            expect(rawRecord).toMatchObject({
                title: 'RawCity',
                payloadVersion: 1,
                payload: { s: { t: 'RawCity' } }
            });
        });

        it('builds a clone-safe serialized snapshot', () => {
            const settings = makeSettings('CloneSafeCity');
            const snapshot = fm.buildSerializedMap(settings, new Map());

            expect(() => structuredClone(snapshot)).not.toThrow();
            expect(snapshot.settings?.centre).toEqual({ lat: 0, lng: 0 });
        });

        it('includes a lastSaved timestamp', async () => {
            const settings = makeSettings('TimestampCity');
            await fm.saveMap(settings, new Map());
            const loaded = await fm.loadMapFromStorage('TimestampCity');
            expect(loaded?.lastSaved).toBeTruthy();
            expect(new Date(loaded?.lastSaved as string).toString()).not.toBe('Invalid Date');
        });

        it('adds the title to the map list', async () => {
            const settings = makeSettings('ListedCity');
            await fm.saveMap(settings, new Map());
            await expect(fm.loadMapListFromStorage()).resolves.toContain('ListedCity');
        });

        it('sets the last map selected', async () => {
            const settings = makeSettings('LastCity');
            await fm.saveMap(settings, new Map());
            await expect(fm.loadLastMapSelected()).resolves.toBe('LastCity');
        });
    });
});
