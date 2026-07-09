import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('leaflet', () => import('../__mocks__/leaflet'));

import * as L from 'leaflet';
import { useMapStore } from '../../../src/stores/mapStore';
import { pinia } from '../../../src/stores';
import { createLtnLayer } from '../../../src/composables/layers/useLtnLayer';
import { createMobilityLaneLayer } from '../../../src/composables/layers/useMobilityLaneLayer';
import { createModalFilterLayer } from '../../../src/composables/layers/useModalFilterLayer';
import { createBusGateLayer } from '../../../src/composables/layers/useBusGateLayer';

function triggerMapEvent(map: L.Map, event: string, payload: any) {
    const handlers = ((map as any)._handlers?.[event] ?? []) as Array<(arg: any) => void>;
    handlers.forEach((h) => h(payload));
}

function triggerLayerClick(layer: any) {
    const handlers = (layer._handlers?.click ?? []) as Array<(arg: any) => void>;
    handlers.forEach((h) => h({ target: layer, latlng: new L.LatLng(0, 0) }));
}

describe('Layer overlap interactions', () => {
    let map: L.Map;

    beforeEach(() => {
        const mapStore = useMapStore(pinia);
        mapStore.setDrawLayer(null);
        mapStore.layerUpdateCount = 0;
        map = new L.Map();
    });

    it('keeps existing LTN polygon and adds mobility line when drawing over it', () => {
        const mapStore = useMapStore(pinia);
        const ltnLayer = createLtnLayer(map);
        const mobilityLayer = createMobilityLaneLayer(map);

        ltnLayer.loadFromGeoJSON({
            features: [
                {
                    geometry: {
                        type: 'Polygon',
                        coordinates: [
                            [
                                [0, 0],
                                [2, 0],
                                [2, 2],
                                [0, 2],
                                [0, 0]
                            ]
                        ]
                    },
                    properties: { label: 'LTN 1', color: '#cc00cc' }
                }
            ]
        } as any);

        expect(ltnLayer.getLayer().getLayers()).toHaveLength(1);
        expect(mobilityLayer.getLayer().getLayers()).toHaveLength(0);

        mapStore.setActiveLayer('mobility-lane');
        triggerMapEvent(map, 'draw:created', {
            layer: {
                getLatLngs: () => [new L.LatLng(0.5, 0.5), new L.LatLng(1.5, 1.5)]
            }
        });

        expect(ltnLayer.getLayer().getLayers()).toHaveLength(1);
        expect(mobilityLayer.getLayer().getLayers()).toHaveLength(1);
    });

    it('removes point marker when clicked even if a polygon exists underneath', () => {
        const mapStore = useMapStore(pinia);
        const markUpdatedSpy = vi.spyOn(mapStore, 'markLayerUpdated');

        const ltnLayer = createLtnLayer(map);
        const modalFilterLayer = createModalFilterLayer(map);

        ltnLayer.loadFromGeoJSON({
            features: [
                {
                    geometry: {
                        type: 'Polygon',
                        coordinates: [
                            [
                                [0, 0],
                                [2, 0],
                                [2, 2],
                                [0, 2],
                                [0, 0]
                            ]
                        ]
                    },
                    properties: { label: 'LTN 1', color: '#cc00cc' }
                }
            ]
        } as any);

        modalFilterLayer.loadFromGeoJSON({
            features: [{ geometry: { coordinates: [1, 1] } }]
        } as any);

        const marker = modalFilterLayer.getLayer().getLayers()[0] as any;
        expect(modalFilterLayer.getLayer().getLayers()).toHaveLength(1);
        expect(ltnLayer.getLayer().getLayers()).toHaveLength(1);

        triggerLayerClick(marker);

        expect(modalFilterLayer.getLayer().getLayers()).toHaveLength(0);
        expect(ltnLayer.getLayer().getLayers()).toHaveLength(1);
        expect(markUpdatedSpy).toHaveBeenCalled();
    });

    it('removes point marker when clicked even if a polyline exists underneath', () => {
        const mapStore = useMapStore(pinia);
        const markUpdatedSpy = vi.spyOn(mapStore, 'markLayerUpdated');

        const mobilityLayer = createMobilityLaneLayer(map);
        const busGateLayer = createBusGateLayer(map);

        mobilityLayer.loadFromGeoJSON({
            features: [
                {
                    geometry: {
                        type: 'LineString',
                        coordinates: [
                            [0, 0],
                            [2, 2]
                        ]
                    }
                }
            ]
        } as any);

        busGateLayer.loadFromGeoJSON({
            features: [{ geometry: { coordinates: [1, 1] } }]
        } as any);

        const marker = busGateLayer.getLayer().getLayers()[0] as any;
        expect(busGateLayer.getLayer().getLayers()).toHaveLength(1);
        expect(mobilityLayer.getLayer().getLayers()).toHaveLength(1);

        triggerLayerClick(marker);

        expect(busGateLayer.getLayer().getLayers()).toHaveLength(0);
        expect(mobilityLayer.getLayer().getLayers()).toHaveLength(1);
        expect(markUpdatedSpy).toHaveBeenCalled();
    });

    it('does not switch to LTN edit mode when a point layer is active', () => {
        const mapStore = useMapStore(pinia);
        const ltnLayer = createLtnLayer(map);

        ltnLayer.loadFromGeoJSON({
            features: [
                {
                    geometry: {
                        type: 'Polygon',
                        coordinates: [
                            [
                                [0, 0],
                                [2, 0],
                                [2, 2],
                                [0, 2],
                                [0, 0]
                            ]
                        ]
                    },
                    properties: { label: 'LTN 1', color: '#cc00cc' }
                }
            ]
        } as any);

        mapStore.setActiveLayer('modal-filter');
        const polygon = ltnLayer.getLayer().getLayers()[0] as any;

        triggerLayerClick(polygon);

        expect(mapStore.activeLayerId).toBe('modal-filter');
    });

    it('does not switch to polyline edit mode when a point layer is active', () => {
        const mapStore = useMapStore(pinia);
        const mobilityLayer = createMobilityLaneLayer(map);

        mobilityLayer.loadFromGeoJSON({
            features: [
                {
                    geometry: {
                        type: 'LineString',
                        coordinates: [
                            [0, 0],
                            [2, 2]
                        ]
                    }
                }
            ]
        } as any);

        mapStore.setActiveLayer('modal-filter');
        const polyline = mobilityLayer.getLayer().getLayers()[0] as any;

        triggerLayerClick(polyline);

        expect(mapStore.activeLayerId).toBe('modal-filter');
    });
});
