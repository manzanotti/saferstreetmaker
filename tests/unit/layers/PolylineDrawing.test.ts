import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setActivePinia } from 'pinia';
import { effectScope, nextTick } from 'vue';

vi.mock('leaflet', () => import('../__mocks__/leaflet'));

import * as L from 'leaflet';
import { pinia } from '../../../src/stores/index';
import { useMapStore } from '../../../src/stores/mapStore';
import { createMobilityLaneLayer } from '../../../src/composables/layers/useMobilityLaneLayer';
import {
    createBusLaneLayer,
    createCarFreeStreetLayer,
    createOneWayStreetLayer,
    createSchoolStreetLayer,
    createTramLineLayer
} from '../../../src/composables/layers/useSimplePolylineLayers';

describe('polyline drawing tool lifecycle', () => {
    beforeEach(() => {
        setActivePinia(pinia);
        useMapStore(pinia).setDrawLayer(null);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('does not let feature mouseout overwrite the drawing handler cursor', () => {
        const scope = effectScope();
        const mapStore = useMapStore(pinia);
        const mouseMarker = document.createElement('div');
        mouseMarker.className = 'leaflet-mouse-marker';
        document.body.append(mouseMarker);
        try {
            scope.run(() => {
                const layer = createMobilityLaneLayer(new L.Map());
                layer.loadFromGeoJSON({
                    features: [
                        {
                            geometry: {
                                type: 'LineString',
                                coordinates: [
                                    [-1.9, 52.5],
                                    [-1.8, 52.6]
                                ]
                            }
                        }
                    ]
                });
                mapStore.setDrawLayer('mobility-lane');
                mouseMarker.style.cursor = 'pointer';
                layer.getLayer().getLayers()[0].fire('mouseout');
                expect(mouseMarker.style.cursor).toBe('pointer');
            });
        } finally {
            mapStore.setDrawLayer(null);
            scope.stop();
            mouseMarker.remove();
        }
    });

    for (const remainsSelected of [true, false]) {
        it(`opens the completed line editor only if drawing remains selected (${remainsSelected})`, async () => {
            const scope = effectScope();
            const mapStore = useMapStore(pinia);
            const map = new L.Map();
            const openPopup = vi.spyOn(map, 'openPopup');
            const popupFactory = vi.spyOn(L, 'popup');
            try {
                scope.run(() => createMobilityLaneLayer(map));
                mapStore.setDrawLayer('mobility-lane');
                map.fire('draw:created', {
                    layer: new L.Polyline([new L.LatLng(52.5, -1.9), new L.LatLng(52.6, -1.8)])
                });
                expect(openPopup).not.toHaveBeenCalled();
                if (!remainsSelected) {
                    mapStore.setDrawLayer(null);
                }
                await nextTick();
                if (remainsSelected) {
                    expect(openPopup).toHaveBeenCalledExactlyOnceWith(
                        popupFactory.mock.results[0].value
                    );
                    expect(mapStore.drawLayerId).toBe('mobility-lane');
                } else {
                    expect(openPopup).not.toHaveBeenCalled();
                }
            } finally {
                mapStore.setDrawLayer(null);
                scope.stop();
            }
        });
    }

    for (const [factory, buttonId] of [
        [createMobilityLaneLayer, 'mobility-lane'],
        [createCarFreeStreetLayer, 'car-free-street'],
        [createSchoolStreetLayer, 'school-street'],
        [createOneWayStreetLayer, 'one-way-street'],
        [createTramLineLayer, 'tram-line'],
        [createBusLaneLayer, 'bus-lane']
    ] as const) {
        it(`${buttonId} uses one repeat-enabled handler and disables it when deselected`, () => {
            const scope = effectScope();
            const mapStore = useMapStore(pinia);
            try {
                scope.run(() => {
                    const map = new L.Map();
                    const enable = vi.fn();
                    const disable = vi.fn();
                    const createTool = vi.spyOn(L.Draw, 'Polyline').mockImplementation(
                        class {
                            enable = enable;
                            disable = disable;
                        }
                    );
                    const layer = factory(map);
                    mapStore.setDrawLayer(buttonId);
                    expect(createTool).toHaveBeenCalledExactlyOnceWith(
                        map,
                        expect.objectContaining({ repeatMode: true })
                    );
                    expect(enable).toHaveBeenCalledOnce();

                    const points = [new L.LatLng(52.5, -1.9), new L.LatLng(52.6, -1.8)];
                    map.fire('draw:created', { layer: new L.Polyline(points) });
                    map.fire('draw:created', { layer: new L.Polyline(points) });
                    expect(layer.getLayer().getLayers()).toHaveLength(2);
                    expect(createTool).toHaveBeenCalledTimes(1);

                    mapStore.setDrawLayer(null);
                    expect(disable).toHaveBeenCalledOnce();
                    map.fire('draw:created', { layer: new L.Polyline(points) });
                    expect(layer.getLayer().getLayers()).toHaveLength(2);
                });
            } finally {
                mapStore.setDrawLayer(null);
                scope.stop();
            }
        });
    }
});
