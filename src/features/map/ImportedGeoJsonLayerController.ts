import * as L from 'leaflet';
import type { ImportedGeoJsonLayer } from '../../models/ImportedGeoJsonLayer';
import { formatPropertyValue } from './importedGeoJson';

export interface ImportedGeoJsonLayerControllerOptions {
    getMap: () => L.Map;
    onFeaturePropertyChange: (
        layerId: string,
        featureIndex: number,
        key: string,
        value: string
    ) => void;
    isReadOnly: () => boolean;
    getActiveLayerId: () => string | null;
}

export class ImportedGeoJsonLayerController {
    private readonly map: L.Map;
    private readonly onFeaturePropertyChange: ImportedGeoJsonLayerControllerOptions['onFeaturePropertyChange'];
    private readonly isReadOnly: () => boolean;
    private readonly getActiveLayerId: () => string | null;
    private readonly leafletLayers = new Map<string, L.GeoJSON>();

    constructor(options: ImportedGeoJsonLayerControllerOptions) {
        this.map = options.getMap();
        this.onFeaturePropertyChange = options.onFeaturePropertyChange;
        this.isReadOnly = options.isReadOnly;
        this.getActiveLayerId = options.getActiveLayerId;
    }

    render(layers: ImportedGeoJsonLayer[]): void {
        const currentIds = new Set(layers.map((layer) => layer.id));
        for (const [id, leafletLayer] of this.leafletLayers) {
            if (!currentIds.has(id)) {
                this.map.removeLayer(leafletLayer);
                this.leafletLayers.delete(id);
            }
        }
        layers.forEach((layer) => this.renderLayer(layer));
    }

    clear(): void {
        for (const leafletLayer of this.leafletLayers.values()) {
            this.map.removeLayer(leafletLayer);
        }
        this.leafletLayers.clear();
    }

    private renderLayer(layer: ImportedGeoJsonLayer): void {
        const previous = this.leafletLayers.get(layer.id);
        if (previous) {
            this.map.removeLayer(previous);
        }

        if (layer.visible === false) {
            this.leafletLayers.delete(layer.id);
            return;
        }

        let featureIndex = 0;
        const leafletLayer = L.geoJSON(layer.featureCollection, {
            pane: 'imported',
            style: {
                color: '#0f766e',
                weight: 2,
                opacity: 0.9,
                fillColor: '#5eead4',
                fillOpacity: 0.16
            },
            pointToLayer: (_feature, latLng) =>
                L.circleMarker(latLng, {
                    radius: 5,
                    color: '#0f766e',
                    weight: 2,
                    fillColor: '#5eead4',
                    fillOpacity: 0.8
                }),
            onEachFeature: (feature, featureLayer) => {
                const index = featureIndex;
                featureIndex += 1;
                featureLayer.bindPopup(() => this.buildPopup(layer, feature, index));
                featureLayer.on('click', (event) => {
                    if (this.getActiveLayerId() !== null) {
                        L.DomEvent.stopPropagation(event);
                        this.map.fire('click', { latlng: event.latlng });
                        this.map.closePopup();
                    }
                });
            }
        });
        leafletLayer.addTo(this.map);
        this.leafletLayers.set(layer.id, leafletLayer);
    }

    private buildPopup(
        layer: ImportedGeoJsonLayer,
        feature: GeoJSON.Feature,
        featureIndex: number
    ): HTMLElement {
        const root = document.createElement('div');
        root.className = 'feature-name-editor';
        const properties = feature.properties ?? {};
        const nameValue = layer.nameProperty
            ? formatPropertyValue(properties[layer.nameProperty]) || layer.name
            : layer.name;

        if (this.isReadOnly() || !layer.nameProperty) {
            const text = document.createElement('span');
            text.className = 'feature-popup-feature-name';
            text.textContent = nameValue;
            root.appendChild(text);
            return root;
        }

        const input = document.createElement('input');
        input.className = 'name-editor';
        input.type = 'text';
        input.value = nameValue;
        input.setAttribute('aria-label', 'Feature title');
        if (layer.nameProperty) {
            const saveName = () => {
                this.onFeaturePropertyChange(
                    layer.id,
                    featureIndex,
                    layer.nameProperty!,
                    input.value
                );
            };
            input.addEventListener('blur', saveName);
            input.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    input.blur();
                }
            });
        }
        root.appendChild(input);

        return root;
    }
}
