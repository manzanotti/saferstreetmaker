import { describe, expect, it, vi } from 'vitest';
import { Settings } from '../../src/models/Settings';
import { SettingsApplier } from '../../src/features/map/SettingsApplier';

function createSettings(title: string, activeLayers: string[] = ['ModalFilters']): Settings {
    const settings = new Settings();
    settings.title = title;
    settings.activeLayers = activeLayers;
    settings.zoom = 14;
    return settings;
}

function createApplier(overrides: Partial<ConstructorParameters<typeof SettingsApplier>[0]> = {}) {
    const currentSettings = createSettings('Current map', ['MobilityLanes']);
    const nextSettings = createSettings('Renamed map', ['ModalFilters', 'MobilityLanes']);
    const options: ConstructorParameters<typeof SettingsApplier>[0] = {
        getCurrentTitle: vi.fn().mockReturnValue('Current map'),
        getCurrentSettings: vi.fn().mockReturnValue(currentSettings),
        buildSnapshot: vi.fn().mockReturnValue({ title: 'Current map', layers: {} }),
        getActiveHistoryTitle: vi.fn().mockReturnValue('Current map'),
        setLastSavedSnapshot: vi.fn(),
        activateHistory: vi.fn().mockResolvedValue(undefined),
        setPendingHistoryMutation: vi.fn(),
        createMutationPayload: vi.fn().mockReturnValue({ before: {}, after: {} }),
        applySettings: vi.fn(),
        removeAllLayers: vi.fn(),
        addLayers: vi.fn(),
        setVisibleLayerIds: vi.fn(),
        saveMapOrThrow: vi.fn().mockResolvedValue(undefined),
        renameHistory: vi.fn().mockResolvedValue(undefined),
        ...overrides
    };

    return { applier: new SettingsApplier(options), options, nextSettings };
}

describe('SettingsApplier', () => {
    it('applies settings, resyncs layers, persists, and renames history', async () => {
        const state = createApplier();

        await state.applier.apply(state.nextSettings);

        expect(state.options.setLastSavedSnapshot).toHaveBeenCalledOnce();
        expect(state.options.setPendingHistoryMutation).toHaveBeenCalledWith(
            expect.objectContaining({ kind: 'settings-apply', layerId: 'settings' })
        );
        expect(state.options.applySettings).toHaveBeenCalledWith(state.nextSettings);
        expect(state.options.removeAllLayers).toHaveBeenCalledOnce();
        expect(state.options.addLayers).toHaveBeenCalledWith(['ModalFilters', 'MobilityLanes']);
        expect(state.options.setVisibleLayerIds).toHaveBeenCalledWith(
            new Set(['ModalFilters', 'MobilityLanes'])
        );
        expect(state.options.saveMapOrThrow).toHaveBeenCalledOnce();
        expect(state.options.renameHistory).toHaveBeenCalledWith('Current map', 'Renamed map');
        expect(state.options.activateHistory).toHaveBeenCalledWith('Renamed map');
    });

    it('activates history before applying when no history is active', async () => {
        const state = createApplier({ getActiveHistoryTitle: vi.fn().mockReturnValue(null) });

        await state.applier.apply(state.nextSettings);

        expect(state.options.activateHistory).toHaveBeenNthCalledWith(1, 'Current map');
        expect(state.options.activateHistory).toHaveBeenNthCalledWith(2, 'Renamed map');
    });
});
