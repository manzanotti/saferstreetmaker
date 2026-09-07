import * as L from 'leaflet';
import type { ImportedGeoJsonLayer } from '../../models/ImportedGeoJsonLayer';
import { formatPropertyValue } from './importedGeoJson';
import { shouldShowPointFeatures } from './pointFeatureVisibility';

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
    private readonly renderedFeatureCollections = new Map<string, GeoJSON.FeatureCollection>();
    private readonly pointFeatureLayers = new Set<
        L.Layer & { setStyle?: (style: L.PathOptions) => void }
    >();

    constructor(options: ImportedGeoJsonLayerControllerOptions) {
        this.map = options.getMap();
        this.onFeaturePropertyChange = options.onFeaturePropertyChange;
        this.isReadOnly = options.isReadOnly;
        this.getActiveLayerId = options.getActiveLayerId;
        this.map.on('zoomend', () => this.updatePointFeatureVisibility());
    }

    render(layers: ImportedGeoJsonLayer[]): void {
        const currentIds = new Set(layers.map((layer) => layer.id));
        for (const [id, leafletLayer] of this.leafletLayers) {
            if (!currentIds.has(id)) {
                this.map.removeLayer(leafletLayer);
                leafletLayer.eachLayer((featureLayer) =>
                    this.pointFeatureLayers.delete(featureLayer)
                );
                this.leafletLayers.delete(id);
                this.renderedFeatureCollections.delete(id);
            }
        }
        layers.forEach((layer) => this.renderLayer(layer));
    }

    clear(): void {
        for (const leafletLayer of this.leafletLayers.values()) {
            this.map.removeLayer(leafletLayer);
        }
        this.leafletLayers.clear();
        this.renderedFeatureCollections.clear();
        this.pointFeatureLayers.clear();
    }

    private renderLayer(layer: ImportedGeoJsonLayer): void {
        const previous = this.leafletLayers.get(layer.id);

        if (
            layer.visible !== false &&
            previous &&
            this.renderedFeatureCollections.get(layer.id) === layer.featureCollection
        ) {
            return;
        }

        if (previous) {
            this.map.removeLayer(previous);
            previous.eachLayer((featureLayer) => this.pointFeatureLayers.delete(featureLayer));
        }

        if (layer.visible === false) {
            this.leafletLayers.delete(layer.id);
            this.renderedFeatureCollections.delete(layer.id);
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
                    fillOpacity: 0.8,
                    className: 'imported-point-feature',
                    pane: 'imported'
                }),
            onEachFeature: (feature, featureLayer) => {
                const index = featureIndex;
                featureIndex += 1;
                if (feature.geometry?.type === 'Point' || feature.geometry?.type === 'MultiPoint') {
                    this.pointFeatureLayers.add(featureLayer);
                }
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
        this.renderedFeatureCollections.set(layer.id, layer.featureCollection);
        this.updatePointFeatureVisibility();
    }

    private updatePointFeatureVisibility(): void {
        const visible = shouldShowPointFeatures(this.map);
        for (const featureLayer of this.pointFeatureLayers) {
            featureLayer.setStyle?.({ opacity: visible ? 0.8 : 0, fillOpacity: visible ? 0.8 : 0 });
        }
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
                if (input.value === nameValue) {
                    return;
                }
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
