import { describe, expect, it, vi } from 'vitest';
import { NewMapCreator } from '../../src/features/map/NewMapCreator';
import type { SerializedMap } from '../../src/services/MapSerializer';
import { Settings } from '../../src/models/Settings';

function createCreator(overrides: Partial<ConstructorParameters<typeof NewMapCreator>[0]> = {}) {
    const snapshot: SerializedMap = { title: 'New map', layers: {} };
    const options: ConstructorParameters<typeof NewMapCreator>[0] = {
        appVersion: '0.10.0',
        loadMapListFromStorage: vi.fn().mockResolvedValue([]),
        clearAndReset: vi.fn(),
        getAllLayerIds: vi.fn().mockReturnValue(['ModalFilters', 'MobilityLanes']),
        getCurrentZoom: vi.fn().mockReturnValue(14),
        getCurrentCentre: vi.fn().mockReturnValue({ lat: 52.5, lng: -1.9 }),
        getDefaultCentre: vi.fn().mockReturnValue({ lat: 0, lng: 0 }),
        applySettings: vi.fn(),
        addLayers: vi.fn(),
        setVisibleLayerIds: vi.fn(),
        buildSnapshot: vi.fn().mockReturnValue(snapshot),
        setLastSavedSnapshot: vi.fn(),
        activateHistory: vi.fn().mockResolvedValue(undefined),
        persistMap: vi.fn().mockResolvedValue(undefined),
        ...overrides
    };

    return { creator: new NewMapCreator(options), options, snapshot };
}

describe('NewMapCreator', () => {
    it('rejects a duplicate title without changing map state', async () => {
        const state = createCreator({
            loadMapListFromStorage: vi.fn().mockResolvedValue(['Existing map'])
        });

        await expect(state.creator.create('Existing map')).resolves.toBe(false);

        expect(state.options.clearAndReset).not.toHaveBeenCalled();
        expect(state.options.applySettings).not.toHaveBeenCalled();
        expect(state.options.persistMap).not.toHaveBeenCalled();
    });

    it('creates a map with all layers active and resets its history', async () => {
        const state = createCreator();

        await expect(state.creator.create('New map')).resolves.toBe(true);

        expect(state.options.clearAndReset).toHaveBeenCalledOnce();
        expect(state.options.applySettings).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'New map',
                readOnly: false,
                activeLayers: ['ModalFilters', 'MobilityLanes'],
                zoom: 14,
                version: '0.10.0'
            })
        );
        expect(state.options.addLayers).toHaveBeenCalledWith(['ModalFilters', 'MobilityLanes']);
        expect(state.options.setVisibleLayerIds).toHaveBeenCalledWith(
            new Set(['ModalFilters', 'MobilityLanes'])
        );
        expect(state.options.setLastSavedSnapshot).toHaveBeenCalledWith(state.snapshot);
        expect(state.options.activateHistory).toHaveBeenCalledWith('New map');
        expect(state.options.persistMap).toHaveBeenCalledOnce();
    });

    it('uses the default centre when the current view has none', async () => {
        const state = createCreator({
            getCurrentCentre: vi.fn().mockReturnValue(null)
        });

        await state.creator.create('New map');

        const appliedSettings = vi.mocked(state.options.applySettings).mock.calls[0][0] as Settings;
        expect(appliedSettings.centre).toMatchObject({ lat: 0, lng: 0 });
    });
});
