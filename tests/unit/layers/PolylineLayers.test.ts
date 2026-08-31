/**
 * Unit tests for all polyline layers (composable API).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useMapStore } from '../../../src/stores/mapStore';
import { pinia } from '../../../src/stores/index';
import { useSelectionStore } from '../../../src/stores/selectionStore';
import { selectFeature } from '../../../src/composables/useAreaSelection';

vi.mock('leaflet', () => import('../__mocks__/leaflet'));

import * as L from 'leaflet';
import { createMobilityLaneLayer } from '../../../src/composables/layers/useMobilityLaneLayer';
import {
    createCarFreeStreetLayer,
    createSchoolStreetLayer,
    createOneWayStreetLayer,
    createTramLineLayer,
    createBusLaneLayer
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

            it('preserves the polyline name in GeoJSON', () => {
                layer.loadFromGeoJSON({
                    features: [
                        {
                            geometry: {
                                type: 'LineString',
                                coordinates: [
                                    [-1.9, 52.5],
                                    [-1.8, 52.6]
                                ]
                            },
                            properties: { historyId: 'line-1', name: 'High Street' }
                        }
                    ]
                });

                expect((layer.toGeoJSON() as any).features[0].properties).toMatchObject({
                    historyId: 'line-1',
                    name: 'High Street'
                });
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
sharedPolylineLayerTests(createBusLaneLayer, 'BusLanes', 'Bus Lanes', 'bus-lane');

describe('MobilityLanes history payloads', () => {
    beforeEach(() => {
        setActivePinia(pinia);
    });

    it('emits compact coordinates for polyline edits', () => {
        const mapStore = useMapStore(pinia);
        const layer = createMobilityLaneLayer(makeMockMap());

        layer.loadFromGeoJSON(
            polylineFeatureCollection([
                [
                    [-1.9, 52.5],
                    [-1.8, 52.6]
                ]
            ])
        );

        const line = layer.getLayer().getLayers()[0] as any;
        line.latlngs = [new L.LatLng(52.5, -1.9), new L.LatLng(52.7, -1.7)];
        line.fire('edit');

        expect(mapStore.lastLayerMutation?.kind).toBe('polyline-edit');
        expect(mapStore.lastLayerMutation?.layerId).toBe('MobilityLanes');
        expect(mapStore.lastLayerMutation?.payload).toMatchObject({
            historyId: expect.any(String),
            pointChanges: [
                {
                    type: 'update',
                    index: 1,
                    before: [-1.8, 52.6],
                    after: [-1.7, 52.7]
                }
            ]
        });
    });

    it('emits insert operations when a polyline gains a vertex', () => {
        const mapStore = useMapStore(pinia);
        const layer = createMobilityLaneLayer(makeMockMap());

        layer.loadFromGeoJSON(
            polylineFeatureCollection([
                [
                    [-1.9, 52.5],
                    [-1.7, 52.7]
                ]
            ])
        );

        const line = layer.getLayer().getLayers()[0] as any;
        line.latlngs = [
            new L.LatLng(52.5, -1.9),
            new L.LatLng(52.6, -1.8),
            new L.LatLng(52.7, -1.7)
        ];
        line.fire('edit');

        expect(mapStore.lastLayerMutation?.payload).toMatchObject({
            historyId: expect.any(String),
            pointChanges: [
                {
                    type: 'insert',
                    index: 1,
                    after: [-1.8, 52.6]
                }
            ]
        });
    });

    it('persists name edits with an undoable whole-feature mutation', () => {
        const mapStore = useMapStore(pinia);
        const layer = createMobilityLaneLayer(makeMockMap());
        const popupFactory = vi.spyOn(L, 'popup');
        layer.loadFromGeoJSON({
            features: [
                {
                    geometry: {
                        type: 'LineString',
                        coordinates: [
                            [-1.9, 52.5],
                            [-1.8, 52.6]
                        ]
                    },
                    properties: { historyId: 'line-1', name: 'Old name' }
                }
            ]
        });

        const line = layer.getLayer().getLayers()[0] as any;
        const popup = popupFactory.mock.results[0].value as any;
        const popupContent = popup.setContent.mock.calls[0][0] as HTMLElement;
        const nameInput = popupContent.querySelector('.name-editor') as HTMLInputElement;
        const nameInputRow = popupContent.querySelector('.feature-name-input-row');
        const nameSaveRow = popupContent.querySelector('.feature-name-save-row');
        const saveNameButton = popupContent.querySelector('.apply-name-button');

        expect(popupContent.querySelector('.feature-name-editor')?.children).toHaveLength(2);
        expect(nameInputRow?.contains(nameInput)).toBe(true);
        expect(nameSaveRow?.contains(saveNameButton)).toBe(true);
        expect(popupContent.children[1].classList.contains('popup-buttons')).toBe(true);

        nameInput.value = 'New name';
        popupContent
            .querySelector('.feature-name-editor')
            ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

        expect((layer.toGeoJSON() as any).features[0].properties.name).toBe('New name');
        expect(mapStore.lastLayerMutation).toMatchObject({
            kind: 'polyline-edit',
            layerId: 'MobilityLanes',
            payload: {
                before: { properties: { historyId: 'line-1', name: 'Old name' } },
                after: { properties: { historyId: 'line-1', name: 'New name' } }
            }
        });
    });
});

describe('MobilityLanes feature clicks', () => {
    beforeEach(() => {
        setActivePinia(pinia);
        useSelectionStore(pinia).deactivate();
        useMapStore(pinia).setDrawLayer(null);
    });

    it('replaces the previously selected line on a plain click', () => {
        const map = makeMockMap();
        const layer = createMobilityLaneLayer(map);

        layer.loadFromGeoJSON(
            polylineFeatureCollection([
                [
                    [-1.9, 52.5],
                    [-1.8, 52.6]
                ],
                [
                    [-1.7, 52.7],
                    [-1.6, 52.8]
                ]
            ])
        );

        const [line1, line2] = layer.getLayer().getLayers() as any[];
        line1.editing = { enable: vi.fn(), disable: vi.fn() };
        line2.editing = { enable: vi.fn(), disable: vi.fn() };

        const selectionStore = useSelectionStore(pinia);
        selectionStore.activate();
        selectFeature(line1 as unknown as L.Layer, 'MobilityLanes', false, true);

        line2.fire('click', {
            latlng: new L.LatLng(52.8, -1.6),
            originalEvent: { clientX: 0, clientY: 0 }
        });

        expect(selectionStore.selected).toHaveLength(2);
        expect(selectionStore.selected.every((entry) => entry.marker === line2)).toBe(true);
        expect(line1.editing.disable).toHaveBeenCalledOnce();
        expect(line2.editing.enable).toHaveBeenCalledOnce();
    });

    it('switches selection to a line in a different layer while editing', () => {
        const map = makeMockMap();
        const mobilityLayer = createMobilityLaneLayer(map);
        const carFreeLayer = createCarFreeStreetLayer(map);

        mobilityLayer.loadFromGeoJSON(
            polylineFeatureCollection([
                [
                    [-1.9, 52.5],
                    [-1.8, 52.6]
                ]
            ])
        );
        carFreeLayer.loadFromGeoJSON(
            polylineFeatureCollection([
                [
                    [-1.7, 52.7],
                    [-1.6, 52.8]
                ]
            ])
        );

        const mobilityLine = mobilityLayer.getLayer().getLayers()[0] as any;
        const carFreeLine = carFreeLayer.getLayer().getLayers()[0] as any;
        mobilityLine.editing = { enable: vi.fn(), disable: vi.fn() };
        carFreeLine.editing = { enable: vi.fn(), disable: vi.fn() };

        const selectionStore = useSelectionStore(pinia);
        const mapStore = useMapStore(pinia);
        selectionStore.activate();
        selectFeature(mobilityLine as unknown as L.Layer, 'MobilityLanes', false, true);
        mapStore.setActiveLayer('mobility-lane');

        carFreeLine.fire('click', {
            latlng: new L.LatLng(52.8, -1.6),
            originalEvent: { clientX: 0, clientY: 0 }
        });

        expect(mapStore.activeLayerId).toBe('car-free-street');
        expect(selectionStore.selected).toHaveLength(2);
        expect(selectionStore.selected.every((entry) => entry.marker === carFreeLine)).toBe(true);
    });

    it('switches from a Bus Lane to a line in a different layer while editing', () => {
        const map = makeMockMap();
        const busLaneLayer = createBusLaneLayer(map);
        const mobilityLayer = createMobilityLaneLayer(map);

        busLaneLayer.loadFromGeoJSON(
            polylineFeatureCollection([
                [
                    [-1.9, 52.5],
                    [-1.8, 52.6]
                ]
            ])
        );
        mobilityLayer.loadFromGeoJSON(
            polylineFeatureCollection([
                [
                    [-1.7, 52.7],
                    [-1.6, 52.8]
                ]
            ])
        );

        const busLane = busLaneLayer.getLayer().getLayers()[0] as any;
        const mobilityLine = mobilityLayer.getLayer().getLayers()[0] as any;
        busLane.editing = { enable: vi.fn(), disable: vi.fn() };
        mobilityLine.editing = { enable: vi.fn(), disable: vi.fn() };

        const selectionStore = useSelectionStore(pinia);
        const mapStore = useMapStore(pinia);
        selectionStore.activate();
        selectFeature(busLane as unknown as L.Layer, 'BusLanes', false, true);
        mapStore.setActiveLayer('bus-lane');

        mobilityLine.fire('click', {
            latlng: new L.LatLng(52.8, -1.6),
            originalEvent: { clientX: 0, clientY: 0 }
        });

        expect(mapStore.activeLayerId).toBe('mobility-lane');
        expect(selectionStore.selected).toHaveLength(2);
        expect(selectionStore.selected.every((entry) => entry.marker === mobilityLine)).toBe(true);
    });
});
