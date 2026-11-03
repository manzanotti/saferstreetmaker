/**
 * Unit tests for FileManager — importing legacy localStorage maps.
 */
import Dexie from 'dexie';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FileManager } from '../../src/services/FileManager';
import {
    seedLegacyLocalStorageMap,
    seedLegacyLocalStorageMapWithoutVersion,
    seedLegacyLocalStorageMapWithoutSettings
} from './FileManager.helpers';

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
});
