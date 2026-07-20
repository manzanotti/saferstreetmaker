import { describe, expect, it, vi } from 'vitest';
import { HistoryLifecycleCoordinator } from '../../src/features/history/HistoryLifecycleCoordinator';
import type { SerializedMap } from '../../src/services/MapSerializer';

const snapshot = (zoom = 12): SerializedMap => ({
    settings: {
        title: 'Map',
        readOnly: false,
        hideToolbar: false,
        activeLayers: [],
        centre: null,
        zoom,
        version: '0.9.0'
    },
    layers: {}
});

function createCoordinator() {
    const options = {
        historyStore: {
            clearStatus: vi.fn(),
            setStatus: vi.fn()
        },
        undoJournal: {
            clearHistory: vi.fn().mockResolvedValue(undefined),
            getStatus: vi.fn().mockResolvedValue({ canUndo: true, canRedo: false }),
            migrateRemoveViewOnlyCheckpoints: vi.fn().mockResolvedValue(undefined)
        },
        buildSnapshot: vi.fn().mockReturnValue(snapshot()),
        setLastSavedSnapshot: vi.fn(),
        loadMapListFromStorage: vi.fn().mockResolvedValue(['Stored map'])
    };

    return { coordinator: new HistoryLifecycleCoordinator(options), options };
}

describe('HistoryLifecycleCoordinator', () => {
    it('resets a map history and stores its initial snapshot when requested', async () => {
        const state = createCoordinator();

        await state.coordinator.activate('New map', { reset: true });

        expect(state.coordinator.getActiveHistoryTitle()).toBe('New map');
        expect(state.options.undoJournal.clearHistory).toHaveBeenCalledWith('New map');
        expect(state.options.setLastSavedSnapshot).toHaveBeenCalledWith(snapshot());
        expect(state.options.historyStore.clearStatus).toHaveBeenCalledOnce();
    });

    it('syncs the active map status and includes it in migration titles', async () => {
        const state = createCoordinator();

        await state.coordinator.activate('Active map');
        await state.coordinator.migrateViewOnlyCheckpoints();

        expect(state.options.historyStore.setStatus).toHaveBeenCalledWith({
            canUndo: true,
            canRedo: false
        });
        expect(state.options.undoJournal.migrateRemoveViewOnlyCheckpoints).toHaveBeenCalledWith(
            ['Stored map', 'Active map'],
            expect.any(Function)
        );
    });

    it('does not surface migration failures', async () => {
        const state = createCoordinator();
        state.options.loadMapListFromStorage.mockRejectedValue(new Error('storage unavailable'));

        await expect(state.coordinator.migrateViewOnlyCheckpoints()).resolves.toBeUndefined();
        expect(state.options.historyStore.setStatus).not.toHaveBeenCalled();
    });
});
