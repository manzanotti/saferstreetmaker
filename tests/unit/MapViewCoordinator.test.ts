import { describe, expect, it, vi } from 'vitest';
import { MapViewCoordinator } from '../../src/features/map/MapViewCoordinator';

function createCoordinator() {
    const map = { setView: vi.fn() };
    const saveMap = vi.fn().mockResolvedValue(undefined);
    const coordinator = new MapViewCoordinator({
        getMap: () => map as never,
        saveMap
    });
    return { coordinator, map, saveMap };
}

describe('MapViewCoordinator', () => {
    it('sets the view to a user location at zoom 17', () => {
        const state = createCoordinator();
        const position = {
            coords: { latitude: 52.5, longitude: -1.9 }
        } as GeolocationPosition;

        state.coordinator.setUserLocation(position);

        expect(state.map.setView).toHaveBeenCalledWith([52.5, -1.9], 17);
    });

    it('sets the default Birmingham view at zoom 12', () => {
        const state = createCoordinator();

        state.coordinator.setDefaultView();

        expect(state.map.setView).toHaveBeenCalledWith([52.5, -1.9], 12);
    });

    it('coalesces scheduled saves within the debounce window', () => {
        vi.useFakeTimers();
        try {
            const state = createCoordinator();

            state.coordinator.scheduleSave();
            state.coordinator.scheduleSave();
            vi.advanceTimersByTime(499);
            expect(state.saveMap).not.toHaveBeenCalled();

            vi.advanceTimersByTime(1);
            expect(state.saveMap).toHaveBeenCalledOnce();
        } finally {
            vi.useRealTimers();
        }
    });

    it('flushes a pending save immediately and cancels its timer', async () => {
        vi.useFakeTimers();
        try {
            const state = createCoordinator();

            state.coordinator.scheduleSave();
            await state.coordinator.flushPendingSave();
            vi.advanceTimersByTime(500);

            expect(state.saveMap).toHaveBeenCalledOnce();
        } finally {
            vi.useRealTimers();
        }
    });

    it('waits for an in-flight save when there is no pending timer', async () => {
        vi.useFakeTimers();
        try {
            let finishSave!: () => void;
            const saveMap = vi.fn().mockImplementation(
                () =>
                    new Promise<void>((resolve) => {
                        finishSave = resolve;
                    })
            );
            const coordinator = new MapViewCoordinator({
                getMap: () => ({ setView: vi.fn() }) as never,
                saveMap
            });

            coordinator.scheduleSave();
            vi.advanceTimersByTime(500);
            const flush = coordinator.flushPendingSave();
            await Promise.resolve();

            expect(saveMap).toHaveBeenCalledOnce();
            let flushed = false;
            void flush.then(() => {
                flushed = true;
            });
            await Promise.resolve();
            expect(flushed).toBe(false);

            finishSave();
            await flush;
            expect(flushed).toBe(true);
        } finally {
            vi.useRealTimers();
        }
    });

    it('waits for an in-flight save before flushing a newly queued save', async () => {
        vi.useFakeTimers();
        try {
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
            const coordinator = new MapViewCoordinator({
                getMap: () => ({ setView: vi.fn() }) as never,
                saveMap
            });

            coordinator.scheduleSave();
            vi.advanceTimersByTime(500);
            coordinator.scheduleSave();
            const flush = coordinator.flushPendingSave();
            await Promise.resolve();

            expect(saveMap).toHaveBeenCalledOnce();
            finishFirstSave();
            await flush;

            expect(saveMap).toHaveBeenCalledTimes(2);
        } finally {
            vi.useRealTimers();
        }
    });
});
