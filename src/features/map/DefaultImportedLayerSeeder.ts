import { nextTick } from 'vue';
import type { ImportedGeoJsonLayer } from '../../models/ImportedGeoJsonLayer';

export interface DefaultImportedLayerSeederDependencies {
    getMapGeneration: () => number;
    getImportedLayerCount: () => number;
    setImportedLayers: (layers: ImportedGeoJsonLayer[]) => void;
    flushPendingViewSave: () => Promise<void>;
    persist: () => Promise<void>;
    syncHistoryStatus: () => Promise<void>;
}

export class DefaultImportedLayerSeeder {
    private defaultSeedingBlocked = false;
    private pendingDefaultLayers = false;
    private userActionRevision = 0;
    private persistenceBarrier: Promise<void> | null = null;

    public constructor(private readonly dependencies: DefaultImportedLayerSeederDependencies) {}

    public block(): void {
        this.defaultSeedingBlocked = true;
        this.userActionRevision += 1;
    }

    public getUserActionRevision(): number {
        return this.userActionRevision;
    }

    public setBlocked(blocked: boolean): void {
        this.defaultSeedingBlocked = blocked;
    }

    public setPending(pending: boolean): void {
        this.pendingDefaultLayers = pending;
    }

    public waitForPersistenceBarrier(): Promise<void> | null {
        return this.persistenceBarrier;
    }

    public async initialise(
        layers: ImportedGeoJsonLayer[],
        options?: { expectedGeneration?: number; allowInitialSeed?: boolean }
    ): Promise<void> {
        const seedGeneration = this.dependencies.getMapGeneration();
        const canSeed = (): boolean => {
            if (
                this.defaultSeedingBlocked ||
                this.dependencies.getMapGeneration() !== seedGeneration ||
                this.dependencies.getImportedLayerCount() > 0
            ) {
                return false;
            }
            if (this.pendingDefaultLayers) {
                return true;
            }
            return (
                options?.allowInitialSeed === true &&
                (options.expectedGeneration === undefined ||
                    options.expectedGeneration === this.dependencies.getMapGeneration())
            );
        };

        if (!canSeed()) {
            return;
        }

        await nextTick();
        await this.dependencies.flushPendingViewSave();
        if (!canSeed()) {
            return;
        }

        let releasePersistenceBarrier: () => void = () => undefined;
        const seedBarrier = new Promise<void>((resolve) => {
            releasePersistenceBarrier = resolve;
        });
        this.persistenceBarrier = seedBarrier;

        try {
            this.dependencies.setImportedLayers(layers);
            this.pendingDefaultLayers = false;
            await this.dependencies.persist();
            await this.dependencies.syncHistoryStatus();
        } finally {
            if (this.persistenceBarrier === seedBarrier) {
                this.persistenceBarrier = null;
            }
            releasePersistenceBarrier();
        }
    }
}
