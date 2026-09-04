import * as L from 'leaflet';

export interface MapViewCoordinatorOptions {
    getMap: () => L.Map;
    saveMap: () => Promise<void>;
}

export class MapViewCoordinator {
    private readonly options: MapViewCoordinatorOptions;
    private saveViewTimer: ReturnType<typeof setTimeout> | undefined;
    private saveViewPromise: Promise<void> | undefined;

    constructor(options: MapViewCoordinatorOptions) {
        this.options = options;
    }

    setUserLocation(position: GeolocationPosition): void {
        this.options.getMap().setView([position.coords.latitude, position.coords.longitude], 17);
    }

    setDefaultView(): void {
        this.options.getMap().setView([52.5, -1.9], 12);
    }

    scheduleSave(): void {
        if (this.saveViewTimer !== undefined) {
            clearTimeout(this.saveViewTimer);
        }
        this.saveViewTimer = setTimeout(() => {
            this.saveViewTimer = undefined;
            void this.startSave();
        }, 500);
    }

    async flushPendingSave(): Promise<void> {
        const pendingTimer = this.saveViewTimer;
        const inFlightSave = this.saveViewPromise;

        if (pendingTimer !== undefined) {
            clearTimeout(pendingTimer);
            this.saveViewTimer = undefined;
        }
        if (inFlightSave !== undefined) {
            await inFlightSave;
        }
        if (pendingTimer !== undefined) {
            await this.startSave();
        }
    }

    private startSave(): Promise<void> {
        const previousSave = this.saveViewPromise ?? Promise.resolve();
        const savePromise = previousSave.then(
            () => this.options.saveMap(),
            () => this.options.saveMap()
        );
        this.saveViewPromise = savePromise;
        void savePromise.then(
            () => this.clearCompletedSave(savePromise),
            () => this.clearCompletedSave(savePromise)
        );
        return savePromise;
    }

    private clearCompletedSave(savePromise: Promise<void>): void {
        if (this.saveViewPromise === savePromise) {
            this.saveViewPromise = undefined;
        }
    }
}
