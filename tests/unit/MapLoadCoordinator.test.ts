import { describe, expect, it, vi } from 'vitest';
import { MapLoadCoordinator } from '../../src/features/map/MapLoadCoordinator';
import { MapLoadSourceError } from '../../src/features/map/MapLoadSourceResolver';

function createCoordinator(
    overrides: Partial<ConstructorParameters<typeof MapLoadCoordinator>[0]> = {}
) {
    const options: ConstructorParameters<typeof MapLoadCoordinator>[0] = {
        sourceResolver: {
            resolve: vi.fn().mockResolvedValue({
                loadingFromStorage: false,
                storageMapName: '',
                geoJSON: { layers: {} }
            })
        },
        resetMap: vi.fn(),
        loadMapData: vi.fn().mockReturnValue(true),
        buildSnapshot: vi.fn().mockReturnValue({ title: 'Map', layers: {} }),
        setLastSavedSnapshot: vi.fn(),
        activateHistory: vi.fn().mockResolvedValue(undefined),
        getActiveHistoryTitle: vi.fn().mockReturnValue('Map'),
        getCurrentTitle: vi.fn().mockReturnValue('Map'),
        setHideToolbar: vi.fn(),
        hasMapInStorage: vi.fn().mockResolvedValue(false),
        showErrors: vi.fn(),
        ...overrides
    };
    return { coordinator: new MapLoadCoordinator(options), options };
}

describe('MapLoadCoordinator', () => {
    it('resets only on reload and activates history after a successful load', async () => {
        const state = createCoordinator();

        await expect(state.coordinator.load(null, '', true, null, null)).resolves.toBe(true);
        await expect(state.coordinator.load(null, '', false, null, null)).resolves.toBe(true);

        expect(state.options.resetMap).toHaveBeenCalledOnce();
        expect(state.options.activateHistory).toHaveBeenCalledWith('Map');
        expect(state.options.setHideToolbar).toHaveBeenLastCalledWith(false);
    });

    it('reports storage source errors with a download flag when the record exists', async () => {
        const state = createCoordinator({
            sourceResolver: {
                resolve: vi
                    .fn()
                    .mockRejectedValue(
                        new MapLoadSourceError('broken', true, 'Broken map', 'stack')
                    )
            },
            hasMapInStorage: vi.fn().mockResolvedValue(true),
            loadMapData: vi.fn().mockReturnValue(false)
        });

        await expect(state.coordinator.load(null, '', false, null, null)).resolves.toBe(false);

        expect(state.options.showErrors).toHaveBeenCalledWith(
            ['There was a problem loading the map from browser storage:', 'broken', 'stack'],
            { showDownloadStorageLink: true }
        );
    });
});
