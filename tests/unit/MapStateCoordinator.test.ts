import { describe, expect, it, vi } from 'vitest';
import { MapStateCoordinator } from '../../src/features/map/MapStateCoordinator';

function createCoordinator() {
    const options = {
        mapLayerController: {
            addLayers: vi.fn(),
            removeAllLayers: vi.fn(),
            clearAllLayers: vi.fn(),
            getAllLayerIds: vi.fn().mockReturnValue(['ModalFilters', 'MobilityLanes'])
        },
        setActiveLayerIds: vi.fn(),
        setVisibleLayerIds: vi.fn(),
        clearGroups: vi.fn(),
        setAllGroupsHidden: vi.fn(),
        resetGroupVisibility: vi.fn()
    };

    return { coordinator: new MapStateCoordinator(options), options };
}

describe('MapStateCoordinator', () => {
    it('delegates layer mounting and removal', () => {
        const state = createCoordinator();

        state.coordinator.addLayers(['MobilityLanes']);
        state.coordinator.removeAllLayers();

        expect(state.options.mapLayerController.addLayers).toHaveBeenCalledWith(['MobilityLanes']);
        expect(state.options.mapLayerController.removeAllLayers).toHaveBeenCalledOnce();
    });

    it('clears layers and resets group state', () => {
        const state = createCoordinator();

        state.coordinator.clearAllLayers();

        expect(state.options.mapLayerController.clearAllLayers).toHaveBeenCalledOnce();
        expect(state.options.clearGroups).toHaveBeenCalledOnce();
        expect(state.options.setAllGroupsHidden).toHaveBeenCalledWith(false);
        expect(state.options.resetGroupVisibility).toHaveBeenCalledOnce();
    });

    it('enables every layer when resetting settings', () => {
        const state = createCoordinator();

        state.coordinator.resetSettings();

        expect(state.options.setActiveLayerIds).toHaveBeenCalledWith([
            'ModalFilters',
            'MobilityLanes'
        ]);
        expect(state.options.setVisibleLayerIds).toHaveBeenCalledWith(
            new Set(['ModalFilters', 'MobilityLanes'])
        );
    });
});
