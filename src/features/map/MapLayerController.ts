import * as L from 'leaflet';
import type { IMapLayer } from '../../composables/layers/IMapLayer';

type SerializedLayerData = Record<string, unknown>;

export interface MapLayerControllerOptions {
    getMap: () => L.Map;
    getLayers: () => IMapLayer[];
}

export class MapLayerController {
    private readonly getMap: () => L.Map;
    private readonly getLayers: () => IMapLayer[];

    constructor(options: MapLayerControllerOptions) {
        this.getMap = options.getMap;
        this.getLayers = options.getLayers;
    }

    getAllLayerIds(): string[] {
        return this.getLayers().map((layer) => layer.id);
    }

    addLayers(activeLayerIds: string[]): void {
        const map = this.getMap();
        this.getLayers().forEach((layer) => {
            if (activeLayerIds.includes(layer.id)) {
                layer.visible = true;
                map.addLayer(layer.getLayer());
            }
        });
    }

    removeAllLayers(): void {
        const map = this.getMap();
        this.getLayers().forEach((layer) => map.removeLayer(layer.getLayer()));
    }

    clearAllLayers(): void {
        const map = this.getMap();
        this.getLayers().forEach((layer) => {
            layer.clearLayer();
            map.removeLayer(layer.getLayer());
        });
    }

    loadLayers(layerData: SerializedLayerData, activeLayerIds: string[]): void {
        const map = this.getMap();
        this.getLayers().forEach((layer) => {
            const layerDataKey = this.getSerializedLayerKey(layer.id, layerData);
            const serializedLayer = layerData[layerDataKey];
            if (serializedLayer) {
                layer.loadFromGeoJSON(serializedLayer as L.GeoJSON);
            }

            if (activeLayerIds.includes(layer.id)) {
                layer.visible = true;
                map.addLayer(layer.getLayer());
            } else {
                map.removeLayer(layer.getLayer());
            }
        });
    }

    private getSerializedLayerKey(layerId: string, layerData: SerializedLayerData): string {
        if (layerId === 'ModalFilters' && layerData.Modals !== undefined) {
            return 'Modals';
        }

        if (layerId === 'MobilityLanes' && layerData.CycleLanes !== undefined) {
            return 'CycleLanes';
        }

        return layerId;
    }
}
