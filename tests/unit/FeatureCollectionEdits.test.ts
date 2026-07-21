import { describe, expect, it } from 'vitest';
import {
    applyPolygonPointChanges,
    applyPolylinePointChanges,
    replaceHistoryFeature,
    replacePolygonState,
    replacePolylineCoordinates
} from '../../src/features/history/featureCollectionEdits';

function makeFeature(historyId: string, coordinates: unknown) {
    return {
        type: 'Feature',
        properties: { historyId, label: 'Before', color: '#111111' },
        geometry: { type: 'LineString', coordinates }
    };
}

describe('feature collection history edits', () => {
    it('replaces a feature by history id without depending on serialised equality', () => {
        const features: unknown[] = [makeFeature('line-1', [[0, 0]])];
        const replacement = makeFeature('line-1', [[1, 1]]);

        expect(replaceHistoryFeature(features, 'line-1', null, replacement)).toBe(true);
        expect(features).toEqual([replacement]);
        expect(replaceHistoryFeature(features, 'missing', null, replacement)).toBe(false);
    });

    it('replaces polyline coordinates without mutating the source feature or input', () => {
        const source = makeFeature('line-1', [
            [0, 0],
            [1, 1]
        ]);
        const coordinates = [
            [2, 2],
            [3, 3]
        ];
        const features: unknown[] = [source];

        expect(replacePolylineCoordinates(features, 'line-1', coordinates)).toBe(true);
        coordinates[0][0] = 99;

        expect(features[0]).not.toBe(source);
        expect((features[0] as typeof source).geometry.coordinates).toEqual([
            [2, 2],
            [3, 3]
        ]);
        expect(source.geometry.coordinates).toEqual([
            [0, 0],
            [1, 1]
        ]);
    });

    it('applies polyline deletions before updates and insertions', () => {
        const features: unknown[] = [
            makeFeature('line-1', [
                [0, 0],
                [1, 1],
                [2, 2],
                [3, 3]
            ])
        ];

        expect(
            applyPolylinePointChanges(
                features,
                {
                    historyId: 'line-1',
                    pointChanges: [
                        { type: 'delete', index: 1, before: [1, 1] },
                        { type: 'update', index: 2, before: [2, 2], after: [20, 20] },
                        { type: 'insert', index: 3, after: [30, 30] }
                    ]
                },
                'redo'
            )
        ).toBe(true);
        expect((features[0] as ReturnType<typeof makeFeature>).geometry.coordinates).toEqual([
            [0, 0],
            [2, 2],
            [20, 20],
            [30, 30]
        ]);
    });

    it('applies polygon point changes and metadata together', () => {
        const features: unknown[] = [
            makeFeature('polygon-1', [
                [
                    [0, 0],
                    [1, 0],
                    [1, 1],
                    [0, 0]
                ]
            ])
        ];

        expect(
            applyPolygonPointChanges(
                features,
                {
                    historyId: 'polygon-1',
                    pointChanges: [
                        {
                            type: 'update',
                            ringIndex: 0,
                            pointIndex: 1,
                            before: [1, 0],
                            after: [2, 0]
                        }
                    ],
                    beforeLabel: 'Before',
                    afterLabel: 'After',
                    beforeColor: '#111111',
                    afterColor: '#222222'
                },
                'redo'
            )
        ).toBe(true);
        expect(features[0]).toMatchObject({
            properties: { historyId: 'polygon-1', label: 'After', color: '#222222' },
            geometry: {
                coordinates: [
                    [
                        [0, 0],
                        [2, 0],
                        [1, 1],
                        [0, 0]
                    ]
                ]
            }
        });
    });

    it('replaces compact polygon state and reports malformed current state', () => {
        const features: unknown[] = [makeFeature('polygon-1', [])];
        const coordinates = [
            [
                [0, 0],
                [1, 0],
                [0, 0]
            ]
        ];

        expect(replacePolygonState(features, 'polygon-1', coordinates, 'Next', '#abcdef')).toBe(
            true
        );
        expect(features[0]).toMatchObject({
            properties: { historyId: 'polygon-1', label: 'Next', color: '#abcdef' },
            geometry: { coordinates }
        });

        expect(
            applyPolygonPointChanges(
                [{ properties: { historyId: 'polygon-1' } }],
                {
                    historyId: 'polygon-1',
                    pointChanges: [],
                    beforeLabel: 'Before',
                    afterLabel: 'After',
                    beforeColor: '#111111',
                    afterColor: '#222222'
                },
                'undo'
            )
        ).toBe(false);
    });
});
