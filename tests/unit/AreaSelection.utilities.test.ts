/**
 * Tests for useAreaSelection — polygonIntersectsBounds, buildFeatureSelectionEntries and setupAreaSelection cleanup.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia } from 'pinia';

vi.mock('leaflet', () => import('./__mocks__/leaflet'));

import * as L from 'leaflet';
import { pinia } from '../../src/stores/index';
import { useSelectionStore } from '../../src/stores/selectionStore';
import { useMapStore } from '../../src/stores/mapStore';
import {
    polygonIntersectsBounds,
    buildFeatureSelectionEntries,
    setupAreaSelection
} from '../../src/composables/useAreaSelection';
import { makeMockMarker, makeSelected } from './AreaSelection.helpers';

describe('polygonIntersectsBounds', () => {
    it('returns true when the rectangle overlaps polygon interior', () => {
        const polygon = {
            getLatLngs: () => [
                [
                    { lat: 0, lng: 0 },
                    { lat: 0, lng: 10 },
                    { lat: 10, lng: 5 }
                ]
            ]
        } as unknown as L.Layer;

        const bounds = {
            contains: (p: L.LatLng) => p.lat >= 2 && p.lat <= 6 && p.lng >= 3 && p.lng <= 7,
            getSouthWest: () => ({ lat: 2, lng: 3 }),
            getNorthEast: () => ({ lat: 6, lng: 7 })
        } as unknown as L.LatLngBounds;

        expect(polygonIntersectsBounds(polygon, bounds)).toBe(true);
    });

    it('returns false when the rectangle only overlaps the polygon bounding box', () => {
        const polygon = {
            getLatLngs: () => [
                [
                    { lat: 0, lng: 0 },
                    { lat: 0, lng: 10 },
                    { lat: 10, lng: 5 }
                ]
            ]
        } as unknown as L.Layer;

        // Small box in the top-left of the polygon bounding box, but fully
        // outside the triangle geometry.
        const bounds = {
            contains: (p: L.LatLng) => p.lat >= 7 && p.lat <= 9 && p.lng >= 0 && p.lng <= 2,
            getSouthWest: () => ({ lat: 7, lng: 0 }),
            getNorthEast: () => ({ lat: 9, lng: 2 })
        } as unknown as L.LatLngBounds;

        expect(polygonIntersectsBounds(polygon, bounds)).toBe(false);
    });
});

describe('setupAreaSelection cleanup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setActivePinia(pinia);
        useSelectionStore(pinia).deactivate();
        useMapStore(pinia).setLayers([]);
    });

    it('clears active selection state when disposed', () => {
        const map = new L.Map() as unknown as L.Map;
        const cleanup = setupAreaSelection(map);
        const selectionStore = useSelectionStore(pinia);

        selectionStore.activate();
        selectionStore.setSelected([makeSelected('ModalFilters', makeMockMarker())]);

        cleanup();

        expect(selectionStore.isActive).toBe(false);
        expect(selectionStore.selected).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// buildFeatureSelectionEntries
// ---------------------------------------------------------------------------
describe('buildFeatureSelectionEntries', () => {
    it('returns one entry per vertex for a polyline', () => {
        const v1 = { lat: 1, lng: 1 } as unknown as L.LatLng;
        const v2 = { lat: 2, lng: 2 } as unknown as L.LatLng;
        const polyline = {
            getLatLngs: () => [v1, v2]
        } as unknown as L.Layer;

        const entries = buildFeatureSelectionEntries(polyline, 'MobilityLanes');

        expect(entries).toHaveLength(2);
        expect(entries[0]).toMatchObject({
            layerId: 'MobilityLanes',
            latLng: v1,
            marker: polyline
        });
        expect(entries[1]).toMatchObject({
            layerId: 'MobilityLanes',
            latLng: v2,
            marker: polyline
        });
    });

    it('reads historyId from the marker feature properties', () => {
        const v1 = { lat: 1, lng: 1 } as unknown as L.LatLng;
        const polyline = {
            feature: { properties: { historyId: 'test-id' } },
            getLatLngs: () => [v1]
        } as unknown as L.Layer;

        const entries = buildFeatureSelectionEntries(polyline, 'MobilityLanes');

        expect(entries[0].historyId).toBe('test-id');
    });

    it('returns empty array when marker has no vertices', () => {
        const polyline = { getLatLngs: () => [] } as unknown as L.Layer;

        expect(buildFeatureSelectionEntries(polyline, 'MobilityLanes')).toHaveLength(0);
    });

    it('handles nested polygon vertex arrays (rings)', () => {
        const v1 = { lat: 0, lng: 0 } as unknown as L.LatLng;
        const v2 = { lat: 1, lng: 0 } as unknown as L.LatLng;
        const v3 = { lat: 0, lng: 1 } as unknown as L.LatLng;
        const polygon = {
            getLatLngs: () => [[v1, v2, v3]]
        } as unknown as L.Layer;

        const entries = buildFeatureSelectionEntries(polygon, 'LtnCells');

        expect(entries).toHaveLength(3);
    });
});
