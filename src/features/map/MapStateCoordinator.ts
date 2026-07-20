import type { MapLayerController } from './MapLayerController';

export interface MapStateCoordinatorOptions {
    mapLayerController: Pick<
        MapLayerController,
        'addLayers' | 'removeAllLayers' | 'clearAllLayers' | 'getAllLayerIds'
    >;
    setActiveLayerIds: (layerIds: string[]) => void;
    setVisibleLayerIds: (layerIds: Set<string>) => void;
    clearGroups: () => void;
    setAllGroupsHidden: (hidden: boolean) => void;
    resetGroupVisibility: () => void;
}

export class MapStateCoordinator {
    private readonly options: MapStateCoordinatorOptions;

    constructor(options: MapStateCoordinatorOptions) {
        this.options = options;
    }

    addLayers(layerIds: string[]): void {
        this.options.mapLayerController.addLayers(layerIds);
    }

    removeAllLayers(): void {
        this.options.mapLayerController.removeAllLayers();
    }

    clearAllLayers(): void {
        this.options.mapLayerController.clearAllLayers();
        this.options.clearGroups();
        this.options.setAllGroupsHidden(false);
        this.options.resetGroupVisibility();
    }

    resetSettings(): void {
        const allLayerIds = this.options.mapLayerController.getAllLayerIds();
        this.options.setActiveLayerIds(allLayerIds);
        this.options.setVisibleLayerIds(new Set(allLayerIds));
    }

    getAllLayerIds(): string[] {
        return this.options.mapLayerController.getAllLayerIds();
    }
}
