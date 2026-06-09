/**
 * Unit tests for all point-marker layers:
 *   ModalFilterLayer, BusGateLayer, TrafficLightsLayer,
 *   PedestrianLightsLayer, ZebraCrossingLayer
 *
 * These layers share the same structure: a GeoJSON layer holding
 * CircleMarkers or DivIcon markers placed on map-click events.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('leaflet', () => import('../__mocks__/leaflet'));
vi.mock('pubsub-js', () => ({
    default: { subscribe: vi.fn(), publish: vi.fn() },
}));

import { ModalFilterLayer } from '../../../src/scripts/layers/ModalFilterLayer';
import { BusGateLayer } from '../../../src/scripts/layers/BusGateLayer';
import { TrafficLightsLayer } from '../../../src/scripts/layers/TrafficLightsLayer';
import { PedestrianLightsLayer } from '../../../src/scripts/layers/PedestrianLightsLayer';
import { ZebraCrossingLayer } from '../../../src/scripts/layers/ZebraCrossingLayer';

// -----------------------------------------------------------------------
// Helper – build a minimal GeoJSON FeatureCollection for a point layer
// -----------------------------------------------------------------------
function pointFeatureCollection(points: [number, number][]) {
    return {
        features: points.map(([lng, lat]) => ({
            geometry: { coordinates: [lng, lat] },
        })),
    };
}

// -----------------------------------------------------------------------
// Shared behaviour exercised against every point-layer class
// -----------------------------------------------------------------------
function sharedPointLayerTests(
    LayerClass: any,
    expectedId: string,
    expectedTitle: string,
    expectedGroupName: string,
    expectedPrefix: string,
) {
    describe(`${LayerClass.name}`, () => {
        let layer: any;

        beforeEach(() => {
            layer = new LayerClass();
        });

        // --- static identity ---
        it('has correct static Id', () => {
            expect(LayerClass.Id).toBe(expectedId);
        });

        // --- initial state ---
        it('has correct id', () => expect(layer.id).toBe(expectedId));
        it('has correct title', () => expect(layer.title).toBe(expectedTitle));
        it('has correct groupName', () => expect(layer.groupName).toBe(expectedGroupName));
        it('starts deselected', () => expect(layer.selected).toBe(false));
        it('starts invisible', () => expect(layer.visible).toBe(false));

        // --- getLayer ---
        it('getLayer returns a GeoJSON instance', () => {
            expect(layer.getLayer()).toBeDefined();
        });

        // --- getToolbarButton ---
        describe('getToolbarButton()', () => {
            it('returns a ToolbarButton with correct id', () => {
                const btn = layer.getToolbarButton();
                expect(btn.id).toBe(expectedPrefix);
            });

            it('returns a ToolbarButton with a tooltip', () => {
                const btn = layer.getToolbarButton();
                expect(typeof btn.tooltip).toBe('string');
                expect(btn.tooltip.length).toBeGreaterThan(0);
            });

            it('passes groupName through', () => {
                const btn = layer.getToolbarButton();
                expect(btn.groupName).toBe(expectedGroupName);
            });

            it('reflects the current selected state', () => {
                layer.selected = true;
                const btn = layer.getToolbarButton();
                expect(btn.selected).toBe(true);
            });
        });

        // --- getLegendEntry ---
        describe('getLegendEntry()', () => {
            it('returns an HTMLElement', () => {
                const el = layer.getLegendEntry();
                expect(el).toBeInstanceOf(HTMLElement);
            });

            it('element id is <layerId>-legend', () => {
                const el = layer.getLegendEntry();
                expect(el.id).toBe(`${expectedId}-legend`);
            });

            it('contains the layer title as text', () => {
                const el = layer.getLegendEntry();
                expect(el.textContent).toContain(expectedTitle);
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

        // --- toGeoJSON ---
        it('toGeoJSON returns a FeatureCollection', () => {
            const geoJson = layer.toGeoJSON() as any;
            expect(geoJson.type).toBe('FeatureCollection');
        });

        // --- clearLayer ---
        describe('clearLayer()', () => {
            it('resets visible to false', () => {
                layer.visible = true;
                layer.clearLayer();
                expect(layer.visible).toBe(false);
            });
        });

        // --- loadFromGeoJSON ---
        describe('loadFromGeoJSON()', () => {
            it('accepts an empty feature collection without throwing', () => {
                expect(() => layer.loadFromGeoJSON({ features: [] })).not.toThrow();
            });

            it('processes point features', () => {
                const addLayerSpy = vi.spyOn(layer.getLayer(), 'addLayer');
                layer.loadFromGeoJSON(pointFeatureCollection([[0.1, 51.5], [-1.9, 52.5]]));
                expect(addLayerSpy).toHaveBeenCalledTimes(2);
            });
        });
    });
}

sharedPointLayerTests(ModalFilterLayer, 'ModalFilters', 'Modal Filters', 'filters', 'modal-filter');
sharedPointLayerTests(BusGateLayer, 'BusGates', 'Bus Gates', 'filters', 'bus-gate');
sharedPointLayerTests(TrafficLightsLayer, 'TrafficLights', 'Traffic Lights', 'traffic-controls', 'traffic-lights');
sharedPointLayerTests(PedestrianLightsLayer, 'PedestrianLights', 'Pedestrian Lights', 'traffic-controls', 'pedestrian-lights');
sharedPointLayerTests(ZebraCrossingLayer, 'ZebraCrossing', 'Zebra Crossing', 'traffic-controls', 'zebra-crossing');
