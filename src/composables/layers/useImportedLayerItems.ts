import { computed, shallowRef } from 'vue';
import * as L from 'leaflet';
import type { ImportedGeoJsonLayer } from '../../models/ImportedGeoJsonLayer';
import { formatPropertyValue } from '../../features/map/importedGeoJson';
import { useImportedLayerStore } from '../../stores/importedLayerStore';
import { useMapStore } from '../../stores/mapStore';
import { useUiStore } from '../../stores/uiStore';

export function useImportedLayerItems(getLayer: () => ImportedGeoJsonLayer) {
    const store = useImportedLayerStore();
    const mapStore = useMapStore();
    const uiStore = useUiStore();
    const query = shallowRef('');
    const namedItems = computed(() => {
        const layer = getLayer();
        return layer.featureCollection.features.flatMap((feature, index) => {
            const name = layer.nameProperty
                ? formatPropertyValue(feature.properties?.[layer.nameProperty]).trim()
                : '';
            return name ? [{ index, name, canCentre: feature.geometry !== null }] : [];
        });
    });
    const filteredItems = computed(() => {
        const search = query.value.trim().toLocaleLowerCase();
        return namedItems.value.filter((item) => item.name.toLocaleLowerCase().includes(search));
    });
    const soloIndex = computed(() => store.itemVisibility.get(getLayer().id)?.soloIndex ?? null);
    const allHidden = computed(() => {
        const layer = getLayer();
        return (
            layer.featureCollection.features.length > 0 &&
            layer.featureCollection.features.every(
                (_, index) => !store.isFeatureVisible(layer.id, index)
            )
        );
    });

    function centreItem(index: number) {
        const feature = getLayer().featureCollection.features[index];
        if (!feature) {
            throw new RangeError(`Unknown imported feature ${getLayer().id}:${index}.`);
        }
        const map = mapStore.map;
        if (!map) {
            uiStore.showErrors(['The map is not ready. Please try again.']);
            return;
        }
        const bounds = L.geoJSON(feature).getBounds();
        if (!bounds.isValid()) {
            uiStore.showErrors(['This item has no location to centre on.']);
            return;
        }
        map.panTo(bounds.getCenter());
    }

    return {
        query,
        namedItems,
        filteredItems,
        soloIndex,
        allHidden,
        centreItem,
        isVisible: (index: number) => store.isFeatureVisible(getLayer().id, index),
        cycleVisibility: (index: number) => store.cycleFeatureVisibility(getLayer().id, index),
        toggleAll: () =>
            store.setAllFeaturesHidden(getLayer().id, soloIndex.value === null && !allHidden.value)
    };
}
