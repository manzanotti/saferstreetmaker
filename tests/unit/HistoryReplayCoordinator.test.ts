import { describe, expect, it, vi } from 'vitest';
import { HistoryReplayCoordinator } from '../../src/features/history/HistoryReplayCoordinator';
import type { HistoryReplayEntry } from '../../src/services/UndoJournal';

function createCoordinator(
    overrides: Partial<ConstructorParameters<typeof HistoryReplayCoordinator>[0]> = {}
) {
    const options: ConstructorParameters<typeof HistoryReplayCoordinator>[0] = {
        transactionEffects: { setHistorySuppressed: vi.fn(), setBusy: vi.fn() },
        getLayers: vi.fn().mockReturnValue([]),
        clearAllLayers: vi.fn(),
        resetSettings: vi.fn(),
        loadMapData: vi.fn().mockReturnValue(true),
        saveMap: vi.fn().mockResolvedValue(undefined),
        buildSnapshot: vi.fn().mockReturnValue({ layers: {} }),
        setLastSavedSnapshot: vi.fn(),
        applySettings: vi.fn(),
        removeAllLayers: vi.fn(),
        addLayers: vi.fn(),
        setVisibleLayerIds: vi.fn(),
        ...overrides
    };
    return { coordinator: new HistoryReplayCoordinator(options), options };
}

function makeReplay(
    snapshot: HistoryReplayEntry['snapshot'],
    mutationPayload?: unknown
): HistoryReplayEntry {
    return {
        direction: 'undo',
        snapshot,
        entry: {
            mapTitle: 'Map',
            sequence: 0,
            kind: 'checkpoint',
            mutationKind: mutationPayload === undefined ? undefined : 'settings-apply',
            mutationLayerId: mutationPayload === undefined ? undefined : 'settings',
            before: snapshot,
            after: snapshot,
            createdAt: new Date().toISOString(),
            mutationPayload
        }
    };
}

describe('HistoryReplayCoordinator', () => {
    it('replays a snapshot inside a transaction and persists it', async () => {
        const state = createCoordinator();

        await expect(state.coordinator.apply(makeReplay({ layers: {} }))).resolves.toBe(true);

        expect(state.options.clearAllLayers).toHaveBeenCalledOnce();
        expect(state.options.resetSettings).toHaveBeenCalledOnce();
        expect(state.options.loadMapData).toHaveBeenCalledWith({ layers: {} });
        expect(state.options.saveMap).toHaveBeenCalledOnce();
        expect(state.options.setLastSavedSnapshot).toHaveBeenCalledOnce();
    });

    it('replays settings mutations and rebuilds active layers', async () => {
        const state = createCoordinator();
        const payload = {
            before: {
                title: 'Before',
                readOnly: false,
                hideToolbar: false,
                activeLayers: [],
                centre: null,
                zoom: 12,
                version: '0.9.0'
            },
            after: {
                title: 'After',
                readOnly: true,
                hideToolbar: true,
                activeLayers: ['ModalFilters'],
                centre: { lat: 52.5, lng: -1.9 },
                zoom: 14,
                version: '0.9.0'
            }
        };

        await expect(state.coordinator.apply(makeReplay({ layers: {} }, payload))).resolves.toBe(
            true
        );

        expect(state.options.applySettings).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'Before',
                activeLayers: [],
                centre: null
            })
        );
        expect(state.options.removeAllLayers).toHaveBeenCalledOnce();
        expect(state.options.addLayers).toHaveBeenCalledWith([]);
        expect(state.options.setVisibleLayerIds).toHaveBeenCalledWith(new Set());
    });
});
