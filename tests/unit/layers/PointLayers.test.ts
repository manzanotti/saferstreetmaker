/**
 * Unit tests for all point-marker layers (composable API).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('leaflet', () => import('../__mocks__/leaflet'));

import { vi } from 'vitest';
import * as L from 'leaflet';
import { createModalFilterLayer } from '../../../src/composables/layers/useModalFilterLayer';
import { createBusGateLayer } from '../../../src/composables/layers/useBusGateLayer';
import {
    createTrafficLightsLayer,
    createPedestrianLightsLayer
} from '../../../src/composables/layers/useTrafficControlLayers';
import { createZebraCrossingLayer } from '../../../src/composables/layers/useZebraCrossingLayer';
import { useMapStore } from '../../../src/stores/mapStore';

function makeMockMap(): L.Map {
    return new L.Map();
}

it('does not place a point when point features are hidden at the current zoom', () => {
    const map = makeMockMap();
    setActivePinia(createPinia());
    const layer = createModalFilterLayer(map);
    const mapStore = useMapStore();

    mapStore.activeLayerId = 'modal-filter';
    map.fire('click', { latlng: new L.LatLng(52.5, -1.9) });

    expect(layer.getLayer().getLayers()).toHaveLength(0);
    expect(mapStore.layerUpdateCount).toBe(0);
});

// -----------------------------------------------------------------------
// Helper – build a minimal GeoJSON FeatureCollection for a point layer
// -----------------------------------------------------------------------
function pointFeatureCollection(points: [number, number][]) {
    return {
        features: points.map(([lng, lat]) => ({
            geometry: { coordinates: [lng, lat] }
        }))
    };
}

// -----------------------------------------------------------------------
// Shared behaviour exercised against every point-layer composable
// -----------------------------------------------------------------------
function sharedPointLayerTests(
    factoryFn: (map: L.Map) => ReturnType<typeof createModalFilterLayer>,
    expectedId: string,
    expectedTitle: string,
    expectedGroupName: string,
    expectedButtonId: string
) {
    describe(`${expectedId}`, () => {
        let layer: ReturnType<typeof factoryFn>;

        beforeEach(() => {
            setActivePinia(createPinia());
            layer = factoryFn(makeMockMap());
        });

        it('has correct id', () => expect(layer.id).toBe(expectedId));
        it('has correct title', () => expect(layer.title).toBe(expectedTitle));
        it('has correct groupName', () => expect(layer.groupName).toBe(expectedGroupName));
        it('starts deselected', () => expect(layer.selected).toBe(false));
        it('starts invisible', () => expect(layer.visible).toBe(false));

        it('getLayer returns a GeoJSON instance', () => {
            expect(layer.getLayer()).toBeDefined();
        });

        describe('getToolbarButton()', () => {
            it('returns a ToolbarButton with correct id', () => {
                expect(layer.getToolbarButton().id).toBe(expectedButtonId);
            });

            it('returns a ToolbarButton with a tooltip', () => {
                const btn = layer.getToolbarButton();
                expect(typeof btn.tooltip).toBe('string');
                expect(btn.tooltip.length).toBeGreaterThan(0);
            });

            it('passes groupName through', () => {
                expect(layer.getToolbarButton().groupName).toBe(expectedGroupName);
            });

            it('reflects the current selected state', () => {
                layer.selected = true;
                expect(layer.getToolbarButton().selected).toBe(true);
            });
        });

        describe('getLegendEntry()', () => {
            it('returns an HTMLElement', () => {
                expect(layer.getLegendEntry()).toBeInstanceOf(HTMLElement);
            });

            it('element id is <layerId>-legend', () => {
                expect(layer.getLegendEntry().id).toBe(`${expectedId}-legend`);
            });

            it('contains the layer title as text', () => {
                expect(layer.getLegendEntry().textContent).toContain(expectedTitle);
            });

            it('click sets visible=true then visible=false on second click', () => {
                const el = layer.getLegendEntry();
                expect(layer.visible).toBe(false);
                el.click();
                expect(layer.visible).toBe(true);
                el.click();
                expect(layer.visible).toBe(false);
            });
        });

        it('toGeoJSON returns a FeatureCollection', () => {
            const geoJson = layer.toGeoJSON() as any;
            expect(geoJson.type).toBe('FeatureCollection');
        });

        describe('clearLayer()', () => {
            it('resets visible to false', () => {
                layer.visible = true;
                layer.clearLayer();
                expect(layer.visible).toBe(false);
            });
        });

        describe('loadFromGeoJSON()', () => {
            it('accepts an empty feature collection without throwing', () => {
                expect(() => layer.loadFromGeoJSON({ features: [] })).not.toThrow();
            });

            it('processes point features', () => {
                const addLayerSpy = vi.spyOn(layer.getLayer(), 'addLayer');
                layer.loadFromGeoJSON(
                    pointFeatureCollection([
                        [0.1, 51.5],
                        [-1.9, 52.5]
                    ])
                );
                expect(addLayerSpy).toHaveBeenCalledTimes(2);
            });
        });
    });
}

sharedPointLayerTests(
    createModalFilterLayer,
    'ModalFilters',
    'Modal Filters',
    'filters',
    'modal-filter'
);
sharedPointLayerTests(createBusGateLayer, 'BusGates', 'Bus Gates', 'filters', 'bus-gate');
sharedPointLayerTests(
    createTrafficLightsLayer,
    'TrafficLights',
    'Traffic Lights',
    'traffic-controls',
    'traffic-lights'
);
sharedPointLayerTests(
    createPedestrianLightsLayer,
    'PedestrianLights',
    'Pedestrian Lights',
    'traffic-controls',
    'pedestrian-lights'
);
sharedPointLayerTests(
    createZebraCrossingLayer,
    'ZebraCrossing',
    'Zebra Crossing',
    'traffic-controls',
    'zebra-crossing'
);
