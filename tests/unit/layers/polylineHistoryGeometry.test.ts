import { describe, expect, it } from 'vitest';
import {
    buildPolylinePointChanges,
    getFeatureCoordinates
} from '../../../src/composables/layers/features/polylineHistoryGeometry';

describe('polyline history geometry', () => {
    it('records multiple removals at the same shifting index', () => {
        expect(
            buildPolylinePointChanges(
                [
                    [0, 0],
                    [1, 1],
                    [2, 2],
                    [3, 3]
                ],
                [
                    [0, 0],
                    [3, 3]
                ]
            )
        ).toEqual([
            { type: 'delete', index: 1, before: [1, 1] },
            { type: 'delete', index: 1, before: [2, 2] }
        ]);
    });

    it('preserves insertion order between unchanged endpoints', () => {
        expect(
            buildPolylinePointChanges(
                [
                    [0, 0],
                    [3, 3]
                ],
                [
                    [0, 0],
                    [1, 1],
                    [2, 2],
                    [3, 3]
                ]
            )
        ).toEqual([
            { type: 'insert', index: 1, after: [1, 1] },
            { type: 'insert', index: 2, after: [2, 2] }
        ]);
    });

    it('uses the full-coordinate fallback for no changes or unsupported dimensions', () => {
        expect(buildPolylinePointChanges([[1, 2]], [[1, 2]])).toBeNull();
        expect(buildPolylinePointChanges([[1, 2, 3]], [[4, 5, 6]])).toBeNull();
        expect(getFeatureCoordinates({ geometry: { coordinates: [[1, 2, 3]] } })).toEqual([[1, 2]]);
    });
});
