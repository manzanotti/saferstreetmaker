import { describe, expect, it, vi } from 'vitest';
import { StoredMapLoader } from '../../src/features/map/StoredMapLoader';
import type { SerializedMap } from '../../src/services/MapSerializer';

function createLoader(overrides: Partial<Parameters<typeof StoredMapLoader>[0]> = {}) {
    const mapData: SerializedMap = { title: 'Loaded map', layers: {} };
    const options: Parameters<typeof StoredMapLoader>[0] = {
        loadMapFromStorage: vi.fn().mockResolvedValue(mapData),
        hasMapInStorage: vi.fn().mockResolvedValue(false),
        clearAndReset: vi.fn(),
        loadMapData: vi.fn().mockReturnValue(true),
        buildSnapshot: vi.fn().mockReturnValue(mapData),
        setLastSavedSnapshot: vi.fn(),
        activateHistory: vi.fn().mockResolvedValue(undefined),
        getCurrentTitle: vi.fn().mockReturnValue('Loaded map'),
        persistMap: vi.fn().mockResolvedValue(undefined),
        showErrors: vi.fn(),
        ...overrides
    };

    return { loader: new StoredMapLoader(options), options, mapData };
}

describe('StoredMapLoader', () => {
    it('resets, loads, activates history, and persists a valid map', async () => {
        const state = createLoader();

        await expect(state.loader.load('Loaded map')).resolves.toBe(true);

        expect(state.options.clearAndReset).toHaveBeenCalledOnce();
        expect(state.options.loadMapData).toHaveBeenCalledWith(state.mapData);
        expect(state.options.setLastSavedSnapshot).toHaveBeenCalledWith(state.mapData);
        expect(state.options.activateHistory).toHaveBeenCalledWith('Loaded map');
        expect(state.options.persistMap).toHaveBeenCalledOnce();
        expect(state.options.showErrors).not.toHaveBeenCalled();
    });

    it('reports a missing map and whether raw storage can be downloaded', async () => {
        const state = createLoader({
            loadMapFromStorage: vi.fn().mockResolvedValue(null),
            hasMapInStorage: vi.fn().mockResolvedValue(true),
            loadMapData: vi.fn().mockReturnValue(false)
        });

        await expect(state.loader.load('Missing map')).resolves.toBe(false);

        expect(state.options.showErrors).toHaveBeenCalledWith(
            [
                'There was a problem loading the map:',
                'Stored map "Missing map" was not found. It may have been deleted in another tab.'
            ],
            { showDownloadStorageLink: true }
        );
        expect(state.options.persistMap).not.toHaveBeenCalled();
    });

    it('reports storage exceptions with their message and stack', async () => {
        const state = createLoader({
            loadMapFromStorage: vi.fn().mockRejectedValue({
                message: 'Storage unavailable',
                stack: 'storage stack'
            })
        });

        await expect(state.loader.load('Broken map')).resolves.toBe(false);

        expect(state.options.showErrors).toHaveBeenCalledWith(
            ['There was a problem loading the map:', 'Storage unavailable', 'storage stack'],
            { showDownloadStorageLink: false }
        );
    });
});
