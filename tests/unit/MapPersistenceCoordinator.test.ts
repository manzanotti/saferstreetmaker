import { describe, expect, it, vi } from 'vitest';
import { MapPersistenceCoordinator } from '../../src/features/map/MapPersistenceCoordinator';

function createCoordinator(
    overrides: Partial<ConstructorParameters<typeof MapPersistenceCoordinator>[0]> = {}
) {
    const before = { layers: { before: {} } };
    const after = { layers: { after: {} } };
    const options: ConstructorParameters<typeof MapPersistenceCoordinator>[0] = {
        saveMap: vi.fn().mockResolvedValue(undefined),
        buildSnapshot: vi.fn().mockReturnValue(after),
        getLastSavedSnapshot: vi.fn().mockReturnValue(before),
        setLastSavedSnapshot: vi.fn(),
        getMutation: vi.fn().mockReturnValue({ kind: 'layer', layerId: 'Layer' }),
        clearMutation: vi.fn(),
        pruneDanglingGroupMembers: vi.fn(),
        isHistorySuppressed: vi.fn().mockReturnValue(false),
        getActiveHistoryTitle: vi.fn().mockReturnValue('Map'),
        recordCheckpoint: vi.fn().mockResolvedValue(undefined),
        syncHistoryStatus: vi.fn().mockResolvedValue(undefined),
        showErrors: vi.fn(),
        ...overrides
    };
    return { coordinator: new MapPersistenceCoordinator(options), options, before, after };
}

describe('MapPersistenceCoordinator', () => {
    it('saves and records a changed snapshot with its mutation', async () => {
        const state = createCoordinator();

        await expect(state.coordinator.persist()).resolves.toBe(true);

        expect(state.options.pruneDanglingGroupMembers).toHaveBeenCalledOnce();
        expect(state.options.saveMap).toHaveBeenCalledOnce();
        expect(state.options.recordCheckpoint).toHaveBeenCalledWith(
            'Map',
            state.before,
            state.after,
            { kind: 'layer', layerId: 'Layer' }
        );
        expect(state.options.setLastSavedSnapshot).toHaveBeenCalledWith(state.after);
        expect(state.options.clearMutation).toHaveBeenCalledOnce();
    });

    it('omits centre and zoom from recorded checkpoint snapshots', async () => {
        const settings = {
            title: 'Map',
            readOnly: false,
            hideToolbar: false,
            activeLayers: [],
            centre: { lat: 52.5, lng: -1.9 },
            zoom: 14,
            version: '1.0.0'
        };
        const before = { settings, layers: { before: {} } };
        const after = {
            settings: { ...settings, centre: { lat: 51.5, lng: -0.1 }, zoom: 18 },
            layers: { after: {} }
        };
        const state = createCoordinator({
            getLastSavedSnapshot: vi.fn().mockReturnValue(before),
            buildSnapshot: vi.fn().mockReturnValue(after)
        });

        await state.coordinator.persist();

        const [, recordedBefore, recordedAfter] = vi.mocked(state.options.recordCheckpoint).mock
            .calls[0];
        expect(recordedBefore.settings).not.toHaveProperty('centre');
        expect(recordedBefore.settings).not.toHaveProperty('zoom');
        expect(recordedAfter.settings).not.toHaveProperty('centre');
        expect(recordedAfter.settings).not.toHaveProperty('zoom');
        expect(state.options.setLastSavedSnapshot).toHaveBeenCalledWith(after);
    });

    it('skips history while replay is suppressing it', async () => {
        const state = createCoordinator({ isHistorySuppressed: vi.fn().mockReturnValue(true) });

        await expect(state.coordinator.persist()).resolves.toBe(true);

        expect(state.options.recordCheckpoint).not.toHaveBeenCalled();
        expect(state.options.syncHistoryStatus).not.toHaveBeenCalled();
    });

    it('reports failures and rethrows the marked error when requested', async () => {
        const failure = new Error('Storage unavailable');
        const state = createCoordinator({ saveMap: vi.fn().mockRejectedValue(failure) });

        await expect(state.coordinator.saveOrThrow()).rejects.toBe(failure);
        expect(state.options.showErrors).toHaveBeenCalledWith([
            'There was a problem saving the map:',
            'Storage unavailable',
            failure.stack
        ]);
        expect(state.options.setLastSavedSnapshot).not.toHaveBeenCalled();
        expect(state.options.clearMutation).not.toHaveBeenCalled();
    });
});
