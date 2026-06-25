import Dexie from 'dexie';
import LZString from 'lz-string';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FileManager } from '../../src/services/FileManager';
import { Settings } from '../../src/models/Settings';
import { IMapLayer } from '../../src/composables/layers/IMapLayer';

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
        iconHtml: '',
        getToolbarButton: vi.fn(),
        getLegendEntry: vi.fn(),
        loadFromGeoJSON: vi.fn(),
        getLayer: vi.fn(),
        toGeoJSON: () => ({ type: 'FeatureCollection', features }),
        clearLayer: vi.fn()
    };
}

function makeSettings(title = 'Test Map'): Settings {
    const s = new Settings();
    s.title = title;
    return s;
}

function seedLegacyLocalStorageMap(title: string, version: string): void {
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

function seedLegacyLocalStorageMapWithoutVersion(title: string): void {
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

function seedLegacyLocalStorageMapWithoutSettings(title: string): void {
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

// --------------------------------------------------------------------------
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

        it('imports legacy localStorage maps last used before 0.9.0', async () => {
            seedLegacyLocalStorageMap('LegacyCity', '0.8.1');

            fm = new FileManager();

            await expect(fm.loadMapFromStorage('LegacyCity')).resolves.toMatchObject({
                settings: { title: 'LegacyCity', version: '0.8.1' }
            });
            await expect(fm.loadLastMapSelected()).resolves.toBe('LegacyCity');
        });

        it('does not import localStorage maps already last used by 0.9.0', async () => {
            seedLegacyLocalStorageMap('CurrentCity', '0.9.0');

            fm = new FileManager();

            await expect(fm.loadMapFromStorage('CurrentCity')).resolves.toBeNull();
            await expect(fm.loadMapListFromStorage()).resolves.toEqual([]);
            await expect(fm.loadLastMapSelected()).resolves.toBe('');
        });

        it('imports legacy localStorage maps whose settings omit version', async () => {
            seedLegacyLocalStorageMapWithoutVersion('NoVersionCity');

            fm = new FileManager();

            await expect(fm.loadMapFromStorage('NoVersionCity')).resolves.toMatchObject({
                settings: { title: 'NoVersionCity', zoom: 12, version: '' }
            });
            await expect(fm.loadLastMapSelected()).resolves.toBe('NoVersionCity');
        });

        it('imports valid legacy localStorage maps that omit the settings block', async () => {
            seedLegacyLocalStorageMapWithoutSettings('OldShapeCity');

            fm = new FileManager();

            await expect(fm.loadMapFromStorage('OldShapeCity')).resolves.toMatchObject({
                settings: {
                    title: 'OldShapeCity',
                    activeLayers: ['ModalFilters'],
                    centre: { lat: 52.5, lng: -1.9 },
                    zoom: 12,
                    version: ''
                },
                layers: {
                    ModalFilters: { type: 'FeatureCollection', features: [] }
                }
            });
            await expect(fm.loadLastMapSelected()).resolves.toBe('OldShapeCity');
        });

        it('does not re-import legacy localStorage maps after they were deleted from IndexedDB', async () => {
            seedLegacyLocalStorageMap('LegacyCity', '0.8.1');

            fm = new FileManager();
            await expect(fm.loadMapFromStorage('LegacyCity')).resolves.toMatchObject({
                settings: { title: 'LegacyCity', version: '0.8.1' }
            });

            await fm.deleteMapFromStorage('LegacyCity');

            fm = new FileManager();

            await expect(fm.loadMapFromStorage('LegacyCity')).resolves.toBeNull();
            await expect(fm.loadMapListFromStorage()).resolves.toEqual([]);
        });
    });

    // -----------------------------------------------------------------------
    // deleteMapFromStorage
    // -----------------------------------------------------------------------
    describe('deleteMapFromStorage', () => {
        it('removes the map from storage', async () => {
            const settings = makeSettings('DeleteMe');
            await fm.saveMap(settings, new Map());
            await fm.deleteMapFromStorage('DeleteMe');
            await expect(fm.loadMapFromStorage('DeleteMe')).resolves.toBeNull();
        });

        it('removes the title from the map list', async () => {
            const settings = makeSettings('RemoveFromList');
            await fm.saveMap(settings, new Map());
            await fm.deleteMapFromStorage('RemoveFromList');
            await expect(fm.loadMapListFromStorage()).resolves.not.toContain('RemoveFromList');
        });

        it('does not throw when deleting a non-existent map', async () => {
            await expect(fm.deleteMapFromStorage('Ghost')).resolves.toBeUndefined();
        });

        it('leaves other maps intact', async () => {
            await fm.saveMap(makeSettings('Keep'), new Map());
            await fm.saveMap(makeSettings('Delete'), new Map());
            await fm.deleteMapFromStorage('Delete');
            await expect(fm.loadMapFromStorage('Keep')).resolves.not.toBeNull();
        });

        it('updates last selected to the most recently saved remaining map', async () => {
            await fm.saveMap(makeSettings('First'), new Map());
            await fm.saveMap(makeSettings('Second'), new Map());

            await expect(fm.loadLastMapSelected()).resolves.toBe('Second');

            await fm.deleteMapFromStorage('Second');

            await expect(fm.loadLastMapSelected()).resolves.toBe('First');
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

    // -----------------------------------------------------------------------
    // loadMapFromRemoteFile
    // -----------------------------------------------------------------------
    describe('loadMapFromRemoteFile', () => {
        it('returns parsed JSON for a successful response', async () => {
            const payload = {
                settings: {
                    title: 'Remote City',
                    readOnly: false,
                    hideToolbar: false,
                    activeLayers: [],
                    centre: null,
                    zoom: 12,
                    version: '1'
                },
                layers: {}
            };

            const fetchMock = vi.fn().mockResolvedValue({
                ok: true,
                json: vi.fn().mockResolvedValue(payload)
            });
            vi.stubGlobal('fetch', fetchMock);

            await expect(fm.loadMapFromRemoteFile('https://example.com/map.json')).resolves.toEqual(
                payload
            );
            expect(fetchMock).toHaveBeenCalledWith('https://example.com/map.json');
        });

        it('throws a clear error for non-OK responses', async () => {
            const fetchMock = vi.fn().mockResolvedValue({
                ok: false,
                status: 404,
                statusText: 'Not Found',
                json: vi.fn()
            });
            vi.stubGlobal('fetch', fetchMock);

            await expect(
                fm.loadMapFromRemoteFile('https://example.com/missing.json')
            ).rejects.toThrow('Failed to load remote map: 404 Not Found');
        });
    });

    // -----------------------------------------------------------------------
    // loadMapFromFile / _readFile cleanup
    // -----------------------------------------------------------------------
    describe('loadMapFromFile cleanup', () => {
        it('removes the hidden input when the user cancels the file picker', () => {
            fm.loadMapFromFile();

            const fileInput = document.body.querySelector('input[type="file"]') as HTMLInputElement;
            expect(fileInput).toBeTruthy();

            fileInput.dispatchEvent(new Event('change'));

            expect(document.body.querySelector('input[type="file"]')).toBeNull();
        });

        it('removes the hidden input when JSON.parse fails for an invalid file', () => {
            const OriginalFileReader = globalThis.FileReader;
            let capturedError: Error | null = null;

            const onWindowError = (event: ErrorEvent) => {
                capturedError = event.error;
                event.preventDefault();
            };

            window.addEventListener('error', onWindowError);

            class MockFileReader {
                onload: ((e: ProgressEvent<FileReader>) => void) | null = null;
                onerror: (() => void) | null = null;

                readAsText() {
                    this.onload?.({
                        target: { result: '{invalid json' }
                    } as unknown as ProgressEvent<FileReader>);
                }
            }

            try {
                (globalThis as any).FileReader = MockFileReader;

                fm.loadMapFromFile();
                const fileInput = document.body.querySelector(
                    'input[type="file"]'
                ) as HTMLInputElement;
                expect(fileInput).toBeTruthy();

                Object.defineProperty(fileInput, 'files', {
                    value: [{ name: 'bad.json' }],
                    configurable: true
                });

                fileInput.dispatchEvent(new Event('change'));

                expect(document.body.querySelector('input[type="file"]')).toBeNull();
                expect(capturedError).toBeInstanceOf(SyntaxError);
            } finally {
                window.removeEventListener('error', onWindowError);
                (globalThis as any).FileReader = OriginalFileReader;
            }
        });
    });
});
