export interface PhasePlaybackUpdate {
    completedPhases: number;
    currentPhase: number | null;
    progress: number;
}

export interface PhasePlaybackClock {
    requestFrame(callback: (time: number) => void): number;
    cancelFrame(handle: number): void;
}

const browserClock: PhasePlaybackClock = {
    requestFrame: (callback) => requestAnimationFrame(callback),
    cancelFrame: (handle) => cancelAnimationFrame(handle)
};

export class PhasePlaybackController {
    private frame: number | null = null;
    private startedAt: number | null = null;
    private phaseIndex = 0;
    private readonly clock: PhasePlaybackClock;

    constructor(
        private readonly phaseCount: number,
        private readonly onUpdate: (update: PhasePlaybackUpdate) => void,
        private readonly onComplete: () => void,
        private readonly phaseDuration = 1000,
        private readonly phaseGap = 1000,
        clock: PhasePlaybackClock = browserClock
    ) {
        this.clock = clock;
    }

    get isRunning(): boolean {
        return this.frame !== null;
    }

    start(): void {
        this.stop();
        if (this.phaseCount <= 0) {
            return;
        }
        this.startedAt = null;
        this.phaseIndex = 0;
        this.onUpdate({ completedPhases: 0, currentPhase: 0, progress: 0 });
        this.frame = this.clock.requestFrame((time) => this.tick(time));
    }

    stop(): void {
        if (this.frame !== null) {
            this.clock.cancelFrame(this.frame);
        }
        this.frame = null;
        this.startedAt = null;
    }

    private tick(time: number): void {
        if (this.startedAt === null) {
            this.startedAt = time;
        }
        const elapsed = time - this.startedAt;
        const cycleDuration = this.phaseDuration + this.phaseGap;
        const completed = Math.floor(elapsed / cycleDuration);
        if (completed >= this.phaseCount) {
            this.onUpdate({ completedPhases: this.phaseCount, currentPhase: null, progress: 1 });
            this.stop();
            this.onComplete();
            return;
        }
        this.phaseIndex = completed;
        const phaseElapsed = elapsed - completed * cycleDuration;
        this.onUpdate({
            completedPhases: completed,
            currentPhase: this.phaseIndex,
            progress: Math.min(1, phaseElapsed / this.phaseDuration)
        });
        this.frame = this.clock.requestFrame((nextTime) => this.tick(nextTime));
    }
}
