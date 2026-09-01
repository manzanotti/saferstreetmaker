import { Settings } from '../../models/Settings';
import type { SerializedMap } from '../../services/MapSerializer';
import type * as L from 'leaflet';

export interface NewMapCreatorOptions {
    appVersion: string;
    loadMapListFromStorage: () => Promise<string[]>;
    clearAndReset: () => void;
    resetImportedLayers: () => void;
    getAllLayerIds: () => string[];
    getCurrentZoom: () => number;
    getCurrentCentre: () => L.LatLng | null;
    getDefaultCentre: () => L.LatLng;
    applySettings: (settings: Settings) => void;
    addLayers: (layerIds: string[]) => void;
    setVisibleLayerIds: (layerIds: Set<string>) => void;
    buildSnapshot: () => SerializedMap;
    setLastSavedSnapshot: (snapshot: SerializedMap) => void;
    activateHistory: (title: string) => Promise<void>;
    persistMap: () => Promise<void>;
}

export class NewMapCreator {
    private readonly options: NewMapCreatorOptions;

    constructor(options: NewMapCreatorOptions) {
        this.options = options;
    }

    async create(title: string): Promise<boolean> {
        const existingTitles = await this.options.loadMapListFromStorage();
        if (existingTitles.includes(title)) {
            return false;
        }

        this.options.clearAndReset();
        this.options.resetImportedLayers();

        const activeLayerIds = this.options.getAllLayerIds();
        const settings = new Settings();
        settings.version = this.options.appVersion;
        settings.title = title;
        settings.readOnly = false;
        settings.activeLayers = activeLayerIds;
        settings.zoom = this.options.getCurrentZoom();
        settings.centre = this.options.getCurrentCentre() ?? this.options.getDefaultCentre();

        this.options.applySettings(settings);
        this.options.addLayers(activeLayerIds);
        this.options.setVisibleLayerIds(new Set(activeLayerIds));

        this.options.setLastSavedSnapshot(this.options.buildSnapshot());
        await this.options.activateHistory(title);
        await this.options.persistMap();
        return true;
    }
}
