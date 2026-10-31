/**
 * Unit tests for FileManager — deleting maps and loading from remote/local files.
 */
import Dexie from 'dexie';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FileManager } from '../../src/services/FileManager';
import { makeSettings } from './FileManager.helpers';

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
