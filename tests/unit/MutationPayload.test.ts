import { describe, expect, it } from 'vitest';
import {
    buildPointFeatureFromMutation,
    isCompactPolygonEditPayload,
    isCompactPolylineEditPayload,
    normaliseFeatureMutationPayload
} from '../../src/features/history/mutationPayload';

describe('history mutation payload helpers', () => {
    it('builds a point feature from compact mutation coordinates', () => {
        expect(
            buildPointFeatureFromMutation({
                kind: 'point-add',
                layerId: 'ModalFilters',
                payload: { lat: 52.5, lng: -1.9, historyId: 'point-1' }
            })
        ).toEqual({
            type: 'Feature',
            properties: { historyId: 'point-1' },
            geometry: { type: 'Point', coordinates: [-1.9, 52.5] }
        });
    });

    it('returns null for an incomplete point mutation', () => {
        expect(
            buildPointFeatureFromMutation({
                kind: 'point-add',
                layerId: 'ModalFilters',
                payload: { lat: 52.5 }
            })
        ).toBeNull();
    });

    it('normalises legacy whole-feature add and delete payloads', () => {
        const feature = { type: 'Feature', properties: { historyId: 'line-1' } };

        expect(normaliseFeatureMutationPayload('polyline-add', feature)).toEqual({
            after: feature
        });
        expect(normaliseFeatureMutationPayload('polygon-delete', feature)).toEqual({
            before: feature
        });
    });

    it('preserves modern and compact edit payloads', () => {
        const modern = { before: { id: 1 }, after: { id: 2 } };
        const compact = { historyId: 'line-1', pointChanges: [] };

        expect(normaliseFeatureMutationPayload('polyline-edit', modern)).toBe(modern);
        expect(normaliseFeatureMutationPayload('polyline-edit', compact)).toBe(compact);
    });

    it('recognises complete compact edit payloads and rejects incomplete ones', () => {
        expect(
            isCompactPolylineEditPayload({
                historyId: 'line-1',
                beforeCoordinates: [],
                afterCoordinates: []
            })
        ).toBe(true);
        expect(isCompactPolylineEditPayload({ historyId: 'line-1' })).toBe(false);

        expect(
            isCompactPolygonEditPayload({
                historyId: 'polygon-1',
                beforeCoordinates: [],
                afterCoordinates: [],
                beforeLabel: 'Before',
                afterLabel: 'After',
                beforeColor: '#000000',
                afterColor: '#ffffff'
            })
        ).toBe(true);
        expect(isCompactPolygonEditPayload({ historyId: 'polygon-1' })).toBe(false);
    });
});
