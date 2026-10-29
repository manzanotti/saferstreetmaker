import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import type { ImportedGeoJsonLayer } from '../models/ImportedGeoJsonLayer';
import { cloneImportedLayers } from '../features/map/importedGeoJson';

interface LayerItemVisibility {
    hiddenIndices: number[];
    soloIndex: number | null;
}

export const useImportedLayerStore = defineStore('importedLayers', () => {
    const layers = ref<ImportedGeoJsonLayer[]>([]);
    const itemVisibility = ref<Record<string, LayerItemVisibility>>({});

    watch(
        () => layers.value.map((layer) => ({ id: layer.id, source: layer.featureCollection })),
        (current, previous) => {
            const sources = new Map(previous?.map((layer) => [layer.id, layer.source]));
            itemVisibility.value = Object.fromEntries(
                Object.entries(itemVisibility.value).filter(([id]) =>
                    current.some((layer) => layer.id === id && sources.get(id) === layer.source)
                )
            );
        },
        { flush: 'sync' }
    );

    function setLayers(value: ImportedGeoJsonLayer[]): void {
        itemVisibility.value = {};
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
        const feature = layer?.featureCollection.features[featureIndex];
        if (feature) {
            feature.properties = feature.properties ?? {};
            feature.properties[key] = value;
        }
    }

    function isFeatureVisible(id: string, featureIndex: number): boolean {
        const state = itemVisibility.value[id];
        return state?.soloIndex != null
            ? state.soloIndex === featureIndex
            : !state?.hiddenIndices.includes(featureIndex);
    }

    function cycleFeatureVisibility(id: string, featureIndex: number): void {
        const layer = layers.value.find((item) => item.id === id);
        if (!layer || !layer.featureCollection.features[featureIndex]) {
            throw new RangeError(`Unknown imported feature ${id}:${featureIndex}.`);
        }
        const state = itemVisibility.value[id] ?? { hiddenIndices: [], soloIndex: null };
        if (state.soloIndex !== null) {
            setAllFeaturesHidden(id, false);
        } else if (state.hiddenIndices.includes(featureIndex)) {
            itemVisibility.value[id] = {
                hiddenIndices: state.hiddenIndices.filter((index) => index !== featureIndex),
                soloIndex: featureIndex
            };
        } else {
            itemVisibility.value[id] = {
                hiddenIndices: [...state.hiddenIndices, featureIndex],
                soloIndex: null
            };
        }
    }

    function setAllFeaturesHidden(id: string, hidden: boolean): void {
        const layer = layers.value.find((item) => item.id === id);
        if (!layer) {
            throw new RangeError(`Unknown imported layer ${id}.`);
        }
        itemVisibility.value[id] = {
            hiddenIndices: hidden ? layer.featureCollection.features.map((_, index) => index) : [],
            soloIndex: null
        };
    }

    function clear(): void {
        itemVisibility.value = {};
        layers.value = [];
    }

    return {
        layers,
        itemVisibility,
        setLayers,
        addLayer,
        deleteLayer,
        toggleVisibility,
        renameLayer,
        setNameProperty,
        updateFeatureProperty,
        isFeatureVisible,
        cycleFeatureVisibility,
        setAllFeaturesHidden,
        clear
    };
});
