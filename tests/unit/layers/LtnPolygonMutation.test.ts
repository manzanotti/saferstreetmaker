import { describe, expect, it } from 'vitest';
import { getPolygonMutationPayload } from '../../../src/composables/layers/ltnPolygonMutation';

const defaultColor = '#cc00cc';

function feature(coordinates: number[][][], historyId = 'ltn-1') {
    return {
        geometry: { coordinates },
        properties: { historyId, label: 'LTN 1', color: defaultColor }
    };
}

describe('getPolygonMutationPayload', () => {
    it('records changed vertices and metadata', () => {
        const before = feature([
            [
                [0, 0],
                [1, 0],
                [1, 1],
                [0, 0]
            ]
        ]);
        const after = feature([
            [
                [0, 0],
                [2, 0],
                [1, 1],
                [0, 0]
            ]
        ]);
        after.properties.label = 'LTN 2';
        after.properties.color = '#00aa00';

        expect(getPolygonMutationPayload(before, after, defaultColor)).toEqual({
            historyId: 'ltn-1',
            pointChanges: [
                {
                    type: 'update',
                    ringIndex: 0,
                    pointIndex: 1,
                    before: [1, 0],
                    after: [2, 0]
                }
            ],
            beforeLabel: 'LTN 1',
            afterLabel: 'LTN 2',
            beforeColor: defaultColor,
            afterColor: '#00aa00'
        });
    });

    it('records inserted and deleted vertices', () => {
        const before = feature([
            [
                [0, 0],
                [1, 0],
                [1, 1],
                [0, 0]
            ]
        ]);
        const inserted = feature([
            [
                [0, 0],
                [0.5, 0],
                [1, 0],
                [1, 1],
                [0, 0]
            ]
        ]);
        const deleted = feature([
            [
                [0, 0],
                [1, 1],
                [0, 0]
            ]
        ]);

        expect(getPolygonMutationPayload(before, inserted, defaultColor).pointChanges).toEqual([
            { type: 'insert', ringIndex: 0, pointIndex: 1, after: [0.5, 0] }
        ]);
        expect(getPolygonMutationPayload(before, deleted, defaultColor).pointChanges).toEqual([
            { type: 'delete', ringIndex: 0, pointIndex: 1, before: [1, 0] }
        ]);
    });

    it('falls back to full coordinates when the ring structure changes', () => {
        const beforeCoordinates = [
            [
                [0, 0],
                [1, 0],
                [0, 0]
            ]
        ];
        const afterCoordinates = [
            [
                [0, 0],
                [1, 0],
                [0, 0]
            ],
            [
                [0.2, 0.2],
                [0.3, 0.2],
                [0.2, 0.2]
            ]
        ];

        expect(
            getPolygonMutationPayload(
                feature(beforeCoordinates),
                feature(afterCoordinates),
                defaultColor
            )
        ).toMatchObject({ beforeCoordinates, afterCoordinates });
    });

    it('uses full coordinates when vertices are unchanged', () => {
        const coordinates = [
            [
                [0, 0],
                [1, 0],
                [0, 0]
            ]
        ];
        const payload = getPolygonMutationPayload(
            feature(coordinates),
            feature(coordinates),
            defaultColor
        );

        expect(payload).toMatchObject({
            beforeCoordinates: coordinates,
            afterCoordinates: coordinates
        });
        expect(payload).not.toHaveProperty('pointChanges');
    });
});
