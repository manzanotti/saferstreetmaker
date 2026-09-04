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

    it('can preserve a mutation while advancing a non-history baseline', async () => {
        const state = createCoordinator();

        await expect(
            state.coordinator.persist({ recordHistory: false, preserveMutation: true })
        ).resolves.toBe(true);

        expect(state.options.recordCheckpoint).not.toHaveBeenCalled();
        expect(state.options.setLastSavedSnapshot).toHaveBeenCalledWith(state.after);
        expect(state.options.clearMutation).not.toHaveBeenCalled();
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

    it('serializes the complete persistence lifecycle across concurrent calls', async () => {
        let finishFirstSave!: () => void;
        const saveMap = vi
            .fn()
            .mockImplementationOnce(
                () =>
                    new Promise<void>((resolve) => {
                        finishFirstSave = resolve;
                    })
            )
            .mockResolvedValue(undefined);
        const state = createCoordinator({ saveMap });

        const first = state.coordinator.persist();
        const second = state.coordinator.persist();
        await Promise.resolve();

        expect(saveMap).toHaveBeenCalledOnce();
        expect(state.options.getLastSavedSnapshot).toHaveBeenCalledOnce();

        finishFirstSave();
        await Promise.all([first, second]);

        expect(saveMap).toHaveBeenCalledTimes(2);
        expect(state.options.getLastSavedSnapshot).toHaveBeenCalledTimes(2);
        expect(state.options.clearMutation).toHaveBeenCalledTimes(2);
    });

    it('flushes queued persistence before a map switch', async () => {
        let finishFirstSave!: () => void;
        let currentMap = 'Previous map';
        const saveMap = vi
            .fn()
            .mockImplementationOnce(
                () =>
                    new Promise<void>((resolve) => {
                        finishFirstSave = resolve;
                    })
            )
            .mockResolvedValue(undefined);
        const state = createCoordinator({ saveMap });

        const first = state.coordinator.persist();
        const second = state.coordinator.persist();
        const switchMap = async (): Promise<void> => {
            await state.coordinator.flush();
            currentMap = 'Replacement map';
        };

        const switchPromise = switchMap();
        await Promise.resolve();
        expect(currentMap).toBe('Previous map');
        expect(saveMap).toHaveBeenCalledOnce();

        finishFirstSave();
        await Promise.all([first, second, switchPromise]);

        expect(currentMap).toBe('Replacement map');
        expect(saveMap).toHaveBeenCalledTimes(2);
    });
});
