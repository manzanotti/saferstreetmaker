import { computed, shallowRef } from 'vue';
import type { ImportedGeoJsonLayer } from '../../models/ImportedGeoJsonLayer';
import { formatPropertyValue } from '../../features/map/importedGeoJson';
import { useImportedLayerStore } from '../../stores/importedLayerStore';

export function useImportedLayerItems(getLayer: () => ImportedGeoJsonLayer) {
    const store = useImportedLayerStore();
    const query = shallowRef('');
    const namedItems = computed(() => {
        const layer = getLayer();
        return layer.featureCollection.features.flatMap((feature, index) => {
            const name = layer.nameProperty
                ? formatPropertyValue(feature.properties?.[layer.nameProperty]).trim()
                : '';
            return name ? [{ index, name }] : [];
        });
    });
    const filteredItems = computed(() => {
        const search = query.value.trim().toLocaleLowerCase();
        return namedItems.value.filter((item) => item.name.toLocaleLowerCase().includes(search));
    });
    const soloIndex = computed(() => store.itemVisibility[getLayer().id]?.soloIndex ?? null);
    const allHidden = computed(() => {
        const layer = getLayer();
        return (
            layer.featureCollection.features.length > 0 &&
            layer.featureCollection.features.every(
                (_, index) => !store.isFeatureVisible(layer.id, index)
            )
        );
    });

    return {
        query,
        namedItems,
        filteredItems,
        soloIndex,
        allHidden,
        isVisible: (index: number) => store.isFeatureVisible(getLayer().id, index),
        cycleVisibility: (index: number) => store.cycleFeatureVisibility(getLayer().id, index),
        toggleAll: () =>
            store.setAllFeaturesHidden(getLayer().id, soloIndex.value === null && !allHidden.value)
    };
}
