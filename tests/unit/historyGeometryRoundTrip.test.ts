import { describe, expect, it } from 'vitest';
import { buildPolylinePointChanges } from '../../src/composables/layers/features/polylineHistoryGeometry';
import {
    applyPolygonPointChanges,
    applyPolylinePointChanges
} from '../../src/features/history/featureCollectionEdits';

describe('consecutive vertex deletion history', () => {
    it('round-trips consecutive polyline deletions through undo and redo', () => {
        const before = [
            [0, 0],
            [1, 1],
            [2, 2],
            [3, 3]
        ];
        const after = [
            [0, 0],
            [3, 3]
        ];
        const pointChanges = buildPolylinePointChanges(before, after);
        if (!pointChanges) {
            throw new Error('Expected compact polyline changes');
        }
        const features: unknown[] = [
            {
                properties: { historyId: 'line-1' },
                geometry: { coordinates: before }
            }
        ];
        const payload = { historyId: 'line-1', pointChanges };

        expect(applyPolylinePointChanges(features, payload, 'redo')).toBe(true);
        expect(features[0]).toMatchObject({ geometry: { coordinates: after } });
        expect(applyPolylinePointChanges(features, payload, 'undo')).toBe(true);
        expect(features[0]).toMatchObject({ geometry: { coordinates: before } });
        expect(applyPolylinePointChanges(features, payload, 'redo')).toBe(true);
        expect(features[0]).toMatchObject({ geometry: { coordinates: after } });
    });

    it('round-trips consecutive polygon ring deletions through undo and redo', () => {
        const before = [
            [
                [0, 0],
                [1, 0],
                [2, 0],
                [3, 0],
                [3, 3],
                [0, 0]
            ]
        ];
        const after = [
            [
                [0, 0],
                [3, 0],
                [3, 3],
                [0, 0]
            ]
        ];
        const features: unknown[] = [
            {
                properties: { historyId: 'polygon-1', label: 'Cell', color: '#cc00cc' },
                geometry: { coordinates: before }
            }
        ];
        const payload = {
            historyId: 'polygon-1',
            pointChanges: [
                { type: 'delete' as const, ringIndex: 0, pointIndex: 1, before: [1, 0] },
                { type: 'delete' as const, ringIndex: 0, pointIndex: 1, before: [2, 0] }
            ],
            beforeLabel: 'Cell',
            afterLabel: 'Cell',
            beforeColor: '#cc00cc',
            afterColor: '#cc00cc'
        };

        expect(applyPolygonPointChanges(features, payload, 'redo')).toBe(true);
        expect(features[0]).toMatchObject({ geometry: { coordinates: after } });
        expect(applyPolygonPointChanges(features, payload, 'undo')).toBe(true);
        expect(features[0]).toMatchObject({ geometry: { coordinates: before } });
        expect(applyPolygonPointChanges(features, payload, 'redo')).toBe(true);
        expect(features[0]).toMatchObject({ geometry: { coordinates: after } });
    });
});
