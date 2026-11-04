import * as L from 'leaflet';
import type { IMapLayer } from '../../composables/layers/IMapLayer';
import { parseStoredLayerGeoJson } from './storedLayerGeoJson';

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
        this.getLayers().forEach((layer) => {
            layer.visible = false;
            map.removeLayer(layer.getLayer());
        });
    }

    clearAllLayers(): void {
        const map = this.getMap();
        this.getLayers().forEach((layer) => {
            layer.visible = false;
            layer.clearLayer();
            map.removeLayer(layer.getLayer());
        });
    }

    loadLayers(layerData: SerializedLayerData, activeLayerIds: string[]): void {
        const map = this.getMap();
        this.getLayers().forEach((layer) => {
            const layerDataKey = this.getSerializedLayerKey(layer.id, layerData);
            const serializedLayer = layerData[layerDataKey];
            if (serializedLayer !== undefined) {
                layer.loadFromGeoJSON(
                    parseStoredLayerGeoJson(serializedLayer, layer.id, layer.kind)
                );
            }

            if (activeLayerIds.includes(layer.id)) {
                layer.visible = true;
                map.addLayer(layer.getLayer());
            } else {
                layer.visible = false;
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
