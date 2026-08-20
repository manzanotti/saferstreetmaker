import { describe, expect, it } from 'vitest';
import {
    PhasePlaybackController,
    type PhasePlaybackClock,
    type PhasePlaybackUpdate
} from '../../src/features/groups/PhasePlaybackController';

class FakeClock implements PhasePlaybackClock {
    private nextHandle = 1;
    private callbacks = new Map<number, (time: number) => void>();

    requestFrame(callback: (time: number) => void): number {
        const handle = this.nextHandle++;
        this.callbacks.set(handle, callback);
        return handle;
    }

    cancelFrame(handle: number): void {
        this.callbacks.delete(handle);
    }

    tick(time: number): void {
        const callbacks = [...this.callbacks.values()];
        this.callbacks.clear();
        callbacks.forEach((callback) => callback(time));
    }
}

describe('PhasePlaybackController', () => {
    it('reveals each phase for one second, then holds before advancing', () => {
        const clock = new FakeClock();
        const updates: PhasePlaybackUpdate[] = [];
        let complete = false;
        const controller = new PhasePlaybackController(
            2,
            (update) => updates.push(update),
            () => {
                complete = true;
            },
            1000,
            1000,
            clock
        );

        controller.start();
        clock.tick(0);
        clock.tick(500);
        expect(updates.at(-1)).toMatchObject({
            completedPhases: 0,
            currentPhase: 0
        });
        expect(updates.at(-1)?.progress).toBeCloseTo(0.5);
        clock.tick(1000);
        expect(updates.at(-1)).toMatchObject({
            completedPhases: 0,
            currentPhase: 0,
            progress: 1
        });
        clock.tick(1500);
        expect(updates.at(-1)).toMatchObject({
            completedPhases: 0,
            currentPhase: 0,
            progress: 1
        });
        clock.tick(2000);
        expect(updates.at(-1)).toMatchObject({ completedPhases: 1, currentPhase: 1, progress: 0 });
        clock.tick(4000);

        expect(complete).toBe(true);
        expect(updates.at(-1)).toMatchObject({
            completedPhases: 2,
            currentPhase: null,
            progress: 1
        });
        expect(controller.isRunning).toBe(false);
    });

    it('cancels a running playback and can restart it', () => {
        const clock = new FakeClock();
        const updates: PhasePlaybackUpdate[] = [];
        const controller = new PhasePlaybackController(
            1,
            (update) => updates.push(update),
            () => {},
            1000,
            1000,
            clock
        );

        controller.start();
        clock.tick(0);
        controller.stop();
        clock.tick(5000);
        expect(controller.isRunning).toBe(false);

        controller.start();
        expect(updates.at(-1)).toMatchObject({ completedPhases: 0, currentPhase: 0, progress: 0 });
        expect(controller.isRunning).toBe(true);
    });
});
