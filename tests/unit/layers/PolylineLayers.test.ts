/**
 * Unit tests for all polyline layers (composable API).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('leaflet', () => import('../__mocks__/leaflet'));

import * as L from 'leaflet';
import { createMobilityLaneLayer } from '../../../src/composables/layers/useMobilityLaneLayer';
import {
    createCarFreeStreetLayer,
    createSchoolStreetLayer,
    createOneWayStreetLayer,
    createTramLineLayer
} from '../../../src/composables/layers/useSimplePolylineLayers';

function makeMockMap(): L.Map {
    return new L.Map();
}

// -----------------------------------------------------------------------
// Helper – build a GeoJSON FeatureCollection for a polyline
// -----------------------------------------------------------------------
function polylineFeatureCollection(lines: [number, number][][]) {
    return {
        features: lines.map((coords) => ({
            geometry: {
                type: 'LineString',
                coordinates: coords
            }
        }))
    };
}

// -----------------------------------------------------------------------
// Shared polyline-layer tests
// -----------------------------------------------------------------------
function sharedPolylineLayerTests(
    factoryFn: (map: L.Map) => any,
    expectedId: string,
    expectedTitle: string,
    expectedButtonId: string
) {
    describe(`${expectedId}`, () => {
        let layer: any;

        beforeEach(() => {
            setActivePinia(createPinia());
            layer = factoryFn(makeMockMap());
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
                expect(layer.getToolbarButton().id).toBe(expectedButtonId);
            });

            it('has a non-empty tooltip', () => {
                expect(layer.getToolbarButton().tooltip.length).toBeGreaterThan(0);
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
                        [
                            [-1.9, 52.5],
                            [-1.8, 52.6]
                        ]
                    ])
                );
                expect(addLayerSpy).toHaveBeenCalledTimes(1);
            });

            it('handles the legacy nested-coordinate format', () => {
                const legacy = {
                    features: [
                        {
                            geometry: {
                                type: 'LineString',
                                coordinates: [
                                    [
                                        [-1.9, 52.5],
                                        [-1.8, 52.6]
                                    ]
                                ]
                            }
                        }
                    ]
                };
                const addLayerSpy = vi.spyOn(layer.getLayer(), 'addLayer');
                expect(() => layer.loadFromGeoJSON(legacy)).not.toThrow();
                expect(addLayerSpy).toHaveBeenCalledTimes(1);
            });
        });
    });
}

sharedPolylineLayerTests(
    createMobilityLaneLayer,
    'MobilityLanes',
    'Mobility Lanes',
    'mobility-lane'
);
sharedPolylineLayerTests(
    createCarFreeStreetLayer,
    'CarFreeStreets',
    'Car-free Streets',
    'car-free-street'
);
sharedPolylineLayerTests(
    createSchoolStreetLayer,
    'SchoolStreet',
    'School Streets',
    'school-street'
);
sharedPolylineLayerTests(
    createOneWayStreetLayer,
    'OneWayStreets',
    'One-way Streets',
    'one-way-street'
);
sharedPolylineLayerTests(createTramLineLayer, 'TramLines', 'Tram Lines', 'tram-line');
