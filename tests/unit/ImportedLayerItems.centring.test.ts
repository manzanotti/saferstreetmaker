/**
 * Unit tests for imported layer items — feature targets, centring and bounds.
 */
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as L from 'leaflet';
import { useImportedLayerStore } from '../../src/stores/importedLayerStore';
import { useImportedLayerItems } from '../../src/composables/layers/useImportedLayerItems';
import { useMapStore } from '../../src/stores/mapStore';
import { useUiStore } from '../../src/stores/uiStore';
import { sanitizeImportedLayers } from '../../src/features/map/importedGeoJson';
import { layer } from './ImportedLayerItems.helpers';

describe('Imported layer items', () => {
    let map: L.Map | undefined;

    beforeEach(() => {
        setActivePinia(createPinia());
    });
    afterEach(() => {
        map?.remove();
        map = undefined;
    });

    function setupMap() {
        map = L.map(document.createElement('div')).setView([0, 0], 14);
        useMapStore().setMap(map);
        return map;
    }

    it.each([
        'constructor',
        'toString',
        '__proto__',
        'valueOf',
        'hasOwnProperty',
        '__defineGetter__'
    ])(
        'supports inherited-object-key layer ID %s through visibility changes and source replacement',
        (id) => {
            const store = useImportedLayerStore();
            store.setLayers(sanitizeImportedLayers([layer(id), layer('other')]));
            const items = useImportedLayerItems(() => store.layers[0]);
            expect(items.isVisible(0)).toBe(true);
            expect(items.soloIndex.value).toBeNull();

            items.cycleVisibility(0);
            expect(items.isVisible(0)).toBe(false);
            expect(store.isFeatureVisible('other', 0)).toBe(true);
            items.cycleVisibility(0);
            expect(items.soloIndex.value).toBe(0);
            expect(items.isVisible(1)).toBe(false);
            items.toggleAll();
            expect(items.isVisible(1)).toBe(true);
            items.toggleAll();
            expect(items.allHidden.value).toBe(true);

            store.addLayer(layer('added'));
            expect(items.allHidden.value).toBe(true);
            store.layers[0].featureCollection = layer(id).featureCollection;
            expect(items.isVisible(0)).toBe(true);
            items.cycleVisibility(0);
            store.deleteLayer(id);
            store.addLayer(layer(id));
            expect(store.isFeatureVisible(id, 0)).toBe(true);
            store.cycleFeatureVisibility(id, 0);
            store.clear();
            store.setLayers([layer(id)]);
            expect(store.isFeatureVisible(id, 0)).toBe(true);
        }
    );

    it.each<{ geometry: GeoJSON.Geometry; expected: [number, number] }>([
        { geometry: { type: 'Point', coordinates: [4, 8, 100] }, expected: [8, 4] },
        {
            geometry: {
                type: 'MultiPoint',
                coordinates: [
                    [2, 4],
                    [6, 8]
                ]
            },
            expected: [6, 4]
        },
        {
            geometry: {
                type: 'LineString',
                coordinates: [
                    [2, 4],
                    [6, 8]
                ]
            },
            expected: [6, 4]
        },
        {
            geometry: {
                type: 'MultiLineString',
                coordinates: [
                    [
                        [2, 4],
                        [6, 8]
                    ]
                ]
            },
            expected: [6, 4]
        },
        {
            geometry: {
                type: 'Polygon',
                coordinates: [
                    [
                        [2, 4],
                        [6, 4],
                        [6, 8],
                        [2, 4]
                    ]
                ]
            },
            expected: [6, 4]
        },
        {
            geometry: {
                type: 'MultiPolygon',
                coordinates: [
                    [
                        [
                            [2, 4],
                            [6, 4],
                            [6, 8],
                            [2, 4]
                        ]
                    ]
                ]
            },
            expected: [6, 4]
        },
        {
            geometry: {
                type: 'GeometryCollection',
                geometries: [
                    { type: 'Point', coordinates: [2, 4] },
                    {
                        type: 'GeometryCollection',
                        geometries: [
                            {
                                type: 'LineString',
                                coordinates: [
                                    [4, 6],
                                    [6, 8]
                                ]
                            }
                        ]
                    }
                ]
            },
            expected: [6, 4]
        }
    ])(
        'centres $geometry.type at its bounds centre without changing zoom or visibility',
        ({ geometry, expected }) => {
            const store = useImportedLayerStore();
            const source = layer();
            source.featureCollection.features[0].geometry = geometry;
            store.setLayers([source]);
            const items = useImportedLayerItems(() => store.layers[0]);
            const activeMap = setupMap();
            const panTo = vi.spyOn(activeMap, 'panTo');
            store.toggleVisibility('wards');
            store.cycleFeatureVisibility('wards', 0);

            items.centreItem(0);

            expect(panTo).toHaveBeenCalledExactlyOnceWith(L.latLng(expected));
            expect(activeMap.getZoom()).toBe(14);
            expect(store.layers[0].visible).toBe(false);
            expect(items.isVisible(0)).toBe(false);
        }
    );

    it('disables locationless item names and reports absent bounds if centring is requested directly', () => {
        const store = useImportedLayerStore();
        const source = layer();
        source.featureCollection.features[0].geometry = null;
        store.setLayers([source]);
        const items = useImportedLayerItems(() => store.layers[0]);
        const panTo = vi.spyOn(setupMap(), 'panTo');
        expect(items.namedItems.value[0].canCentre).toBe(false);

        items.centreItem(0);

        expect(panTo).not.toHaveBeenCalled();
        expect(useUiStore().errorMessages).toEqual(['This item has no location to centre on.']);
        expect(() => items.centreItem(99)).toThrow(RangeError);
    });

    it('reports an unavailable map instead of silently ignoring the action', () => {
        const store = useImportedLayerStore();
        store.setLayers([layer()]);

        useImportedLayerItems(() => store.layers[0]).centreItem(0);

        expect(useUiStore().errorMessages).toEqual(['The map is not ready. Please try again.']);
    });
});
