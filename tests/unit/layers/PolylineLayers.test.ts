/**
 * Unit tests for all polyline layers:
 *   MobilityLaneLayer, CarFreeStreetLayer, SchoolStreetLayer,
 *   OneWayStreetLayer, TramLineLayer
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('leaflet', () => import('../__mocks__/leaflet'));
vi.mock('pubsub-js', () => ({
    default: { subscribe: vi.fn(), publish: vi.fn() },
}));

import { MobilityLaneLayer } from '../../../src/scripts/layers/MobilityLaneLayer';
import { CarFreeStreetLayer } from '../../../src/scripts/layers/CarFreeStreetLayer';
import { SchoolStreetLayer } from '../../../src/scripts/layers/SchoolStreetLayer';
import { OneWayStreetLayer } from '../../../src/scripts/layers/OneWayStreetLayer';
import { TramLineLayer } from '../../../src/scripts/layers/TramLineLayer';

// -----------------------------------------------------------------------
// Helper – build a GeoJSON FeatureCollection for a polyline
// -----------------------------------------------------------------------
function polylineFeatureCollection(lines: [number, number][][]) {
    return {
        features: lines.map((coords) => ({
            geometry: {
                type: 'LineString',
                coordinates: coords,
            },
        })),
    };
}

// -----------------------------------------------------------------------
// Shared polyline-layer tests
// -----------------------------------------------------------------------
function sharedPolylineLayerTests(
    LayerClass: any,
    expectedId: string,
    expectedTitle: string,
    expectedPrefix: string,
) {
    describe(`${LayerClass.name}`, () => {
        let layer: any;

        beforeEach(() => {
            layer = new LayerClass();
        });

        it('has correct static Id', () => {
            expect(LayerClass.Id).toBe(expectedId);
        });

        it('has correct id', () => expect(layer.id).toBe(expectedId));
        it('has correct title', () => expect(layer.title).toBe(expectedTitle));
        it('starts deselected', () => expect(layer.selected).toBe(false));
        it('starts invisible', () => expect(layer.visible).toBe(false));

        it('getLayer returns a GeoJSON instance', () => {
            expect(layer.getLayer()).toBeDefined();
        });

        describe('getToolbarButton()', () => {
            it('returns correct id', () => {
                expect(layer.getToolbarButton().id).toBe(expectedPrefix);
            });

            it('has a non-empty tooltip', () => {
                const btn = layer.getToolbarButton();
                expect(btn.tooltip.length).toBeGreaterThan(0);
            });

            it('reflects selected state', () => {
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

            it('contains the layer title', () => {
                expect(layer.getLegendEntry().textContent).toContain(expectedTitle);
            });

            it('click toggles visible flag', () => {
                const el = layer.getLegendEntry();
                el.click();
                expect(layer.visible).toBe(true);
                el.click();
                expect(layer.visible).toBe(false);
            });
        });

        describe('clearLayer()', () => {
            it('resets visible to false', () => {
                layer.visible = true;
                layer.clearLayer();
                expect(layer.visible).toBe(false);
            });
        });

        it('toGeoJSON returns a FeatureCollection', () => {
            const json = layer.toGeoJSON() as any;
            expect(json.type).toBe('FeatureCollection');
        });

        describe('loadFromGeoJSON()', () => {
            it('handles null / undefined gracefully', () => {
                expect(() => layer.loadFromGeoJSON(null)).not.toThrow();
                expect(() => layer.loadFromGeoJSON(undefined)).not.toThrow();
            });

            it('accepts an empty feature collection', () => {
                expect(() => layer.loadFromGeoJSON({ features: [] })).not.toThrow();
            });

            it('loads a polyline feature', () => {
                const addLayerSpy = vi.spyOn(layer.getLayer(), 'addLayer');
                layer.loadFromGeoJSON(
                    polylineFeatureCollection([
                        [[-1.9, 52.5], [-1.8, 52.6]],
                    ])
                );
                expect(addLayerSpy).toHaveBeenCalledTimes(1);
            });

            it('handles the legacy nested-coordinate format', () => {
                // Coordinates wrapped in an extra array (historical bug)
                const legacy = {
                    features: [{
                        geometry: {
                            type: 'LineString',
                            coordinates: [[[-1.9, 52.5], [-1.8, 52.6]]],
                        },
                    }],
                };
                const addLayerSpy = vi.spyOn(layer.getLayer(), 'addLayer');
                expect(() => layer.loadFromGeoJSON(legacy)).not.toThrow();
                expect(addLayerSpy).toHaveBeenCalledTimes(1);
            });
        });
    });
}

sharedPolylineLayerTests(MobilityLaneLayer, 'MobilityLanes', 'Mobility Lanes', 'mobility-lane');
sharedPolylineLayerTests(CarFreeStreetLayer, 'CarFreeStreets', 'Car-free Streets', 'car-free-street');
sharedPolylineLayerTests(SchoolStreetLayer, 'SchoolStreet', 'School Streets', 'school-street');
sharedPolylineLayerTests(OneWayStreetLayer, 'OneWayStreets', 'One-way Streets', 'one-way-street');
sharedPolylineLayerTests(TramLineLayer, 'TramLines', 'Tram Lines', 'tram-line');
