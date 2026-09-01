import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { ImportedGeoJsonLayer } from '../models/ImportedGeoJsonLayer';
import { cloneImportedLayers } from '../features/map/importedGeoJson';

export const useImportedLayerStore = defineStore('importedLayers', () => {
    const layers = ref<ImportedGeoJsonLayer[]>([]);

    function setLayers(value: ImportedGeoJsonLayer[]): void {
        layers.value = cloneImportedLayers(value);
    }

    function addLayer(layer: ImportedGeoJsonLayer): void {
        layers.value = [...layers.value, cloneImportedLayers([layer])[0]];
    }

    function deleteLayer(id: string): void {
        layers.value = layers.value.filter((layer) => layer.id !== id);
    }

    function toggleVisibility(id: string): void {
        const layer = layers.value.find((item) => item.id === id);
        if (layer) {
            layer.visible = layer.visible === false;
        }
    }

    function renameLayer(id: string, name: string): void {
        const layer = layers.value.find((item) => item.id === id);
        if (layer) {
            layer.name = name;
        }
    }

    function setNameProperty(id: string, nameProperty: string | null): void {
        const layer = layers.value.find((item) => item.id === id);
        if (layer) {
            layer.nameProperty = nameProperty;
        }
    }

    function updateFeatureProperty(
        id: string,
        featureIndex: number,
        key: string,
        value: string
    ): void {
        const layer = layers.value.find((item) => item.id === id);
        const properties = layer?.featureCollection.features[featureIndex]?.properties;
        if (properties) {
            properties[key] = value;
        }
    }

    function clear(): void {
        layers.value = [];
    }

    return {
        layers,
        setLayers,
        addLayer,
        deleteLayer,
        toggleVisibility,
        renameLayer,
        setNameProperty,
        updateFeatureProperty,
        clear
    };
});
