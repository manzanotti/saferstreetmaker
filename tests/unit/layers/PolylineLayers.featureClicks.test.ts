/**
 * Unit tests for MobilityLanes feature click selection.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia } from 'pinia';
import { useMapStore } from '../../../src/stores/mapStore';
import { pinia } from '../../../src/stores/index';
import { useSelectionStore } from '../../../src/stores/selectionStore';
import { selectFeature } from '../../../src/composables/useAreaSelection';

vi.mock('leaflet', () => import('../__mocks__/leaflet'));

import * as L from 'leaflet';
import { createMobilityLaneLayer } from '../../../src/composables/layers/useMobilityLaneLayer';
import {
    createCarFreeStreetLayer,
    createBusLaneLayer
} from '../../../src/composables/layers/useSimplePolylineLayers';
import { makeMockMap, polylineFeatureCollection } from './PolylineLayers.helpers';

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
