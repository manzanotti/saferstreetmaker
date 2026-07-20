import * as L from 'leaflet';

export interface MapViewCoordinatorOptions {
    getMap: () => L.Map;
    saveMap: () => Promise<void>;
}

export class MapViewCoordinator {
    private readonly options: MapViewCoordinatorOptions;
    private saveViewTimer: ReturnType<typeof setTimeout> | undefined;

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
            void this.options.saveMap();
        }, 500);
    }
}
