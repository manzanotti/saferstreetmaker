import { describe, expect, it } from 'vitest';
import type { LayerMutationEvent } from '../../src/models/LayerMutation';
import { replayFeatureMutation } from '../../src/features/history/featureMutationReplay';

function makeFeature(historyId: string, coordinates: unknown, geometryType = 'LineString') {
    return {
        type: 'Feature',
        properties: { historyId, label: 'Before', color: '#111111' },
        geometry: { type: geometryType, coordinates }
    };
}

function replay(features: unknown[], mutation: LayerMutationEvent, direction: 'undo' | 'redo') {
    return replayFeatureMutation({ features }, mutation, direction);
}

describe('feature mutation replay', () => {
    it('replays compact point add and delete without mutating the input array', () => {
        const existing = makeFeature('existing', [0, 0], 'Point');
        const current = [existing];
        const addMutation: LayerMutationEvent = {
            kind: 'point-add',
            layerId: 'ModalFilters',
            payload: { lat: 52.5, lng: -1.9, historyId: 'point-1' }
        };

        const added = replay(current, addMutation, 'redo');
        expect(added?.features).toHaveLength(2);
        expect(added?.features[1]).toMatchObject({
            properties: { historyId: 'point-1' },
            geometry: { type: 'Point', coordinates: [-1.9, 52.5] }
        });
        expect(current).toEqual([existing]);

        expect(replay(added?.features ?? [], addMutation, 'redo')?.features).toHaveLength(2);
        expect(replay(added?.features ?? [], addMutation, 'undo')?.features).toEqual([existing]);

        const deleteMutation = { ...addMutation, kind: 'point-delete' as const };
        expect(replay([existing], deleteMutation, 'undo')?.features).toHaveLength(2);
        expect(replay(added?.features ?? [], deleteMutation, 'redo')?.features).toEqual([existing]);
    });

    it('restores and removes point batches by history id', () => {
        const first = makeFeature('point-1', [0, 0], 'Point');
        const second = makeFeature('point-2', [1, 1], 'Point');
        const mutation: LayerMutationEvent = {
            kind: 'point-batch-delete',
            layerId: 'ModalFilters',
            payload: { points: [first, second] }
        };

        expect(replay([first], mutation, 'undo')?.features).toEqual([first, second]);
        expect(replay([first, second], mutation, 'redo')?.features).toEqual([]);
    });

    it('replays whole-feature add and delete mutations without duplicates', () => {
        const line = makeFeature('line-1', [
            [0, 0],
            [1, 1]
        ]);
        const addMutation: LayerMutationEvent = {
            kind: 'polyline-add',
            layerId: 'MobilityLanes',
            payload: { after: line }
        };

        expect(replay([], addMutation, 'redo')?.features).toEqual([line]);
        expect(replay([line], addMutation, 'redo')?.features).toEqual([line]);
        expect(replay([line], addMutation, 'undo')?.features).toEqual([]);

        const deleteMutation: LayerMutationEvent = {
            kind: 'polygon-batch-delete',
            layerId: 'LtnCells',
            payload: { before: line }
        };
        expect(replay([], deleteMutation, 'undo')?.features).toEqual([line]);
        expect(replay([line], deleteMutation, 'redo')?.features).toEqual([]);
    });

    it('routes compact polyline edits by history id', () => {
        const beforeCoordinates = [
            [0, 0],
            [1, 1]
        ];
        const afterCoordinates = [
            [0, 0],
            [2, 2]
        ];
        const mutation: LayerMutationEvent = {
            kind: 'polyline-edit',
            layerId: 'MobilityLanes',
            payload: { historyId: 'line-1', beforeCoordinates, afterCoordinates }
        };

        const undone = replay([makeFeature('line-1', afterCoordinates)], mutation, 'undo');
        expect(undone?.features[0]).toMatchObject({ geometry: { coordinates: beforeCoordinates } });

        const redone = replay(undone?.features ?? [], mutation, 'redo');
        expect(redone?.features[0]).toMatchObject({ geometry: { coordinates: afterCoordinates } });
    });

    it('routes compact polygon edits with metadata', () => {
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
                [2, 0],
                [0, 0]
            ]
        ];
        const mutation: LayerMutationEvent = {
            kind: 'polygon-edit',
            layerId: 'LtnCells',
            payload: {
                historyId: 'polygon-1',
                beforeCoordinates,
                afterCoordinates,
                beforeLabel: 'Before',
                afterLabel: 'After',
                beforeColor: '#111111',
                afterColor: '#222222'
            }
        };

        const result = replay(
            [makeFeature('polygon-1', beforeCoordinates, 'Polygon')],
            mutation,
            'redo'
        );
        expect(result?.features[0]).toMatchObject({
            properties: { historyId: 'polygon-1', label: 'After', color: '#222222' },
            geometry: { coordinates: afterCoordinates }
        });
    });

    it('replays legacy whole-feature edits in both directions', () => {
        const before = makeFeature('line-1', [
            [0, 0],
            [1, 1]
        ]);
        const after = makeFeature('line-1', [
            [0, 0],
            [2, 2]
        ]);
        const mutation: LayerMutationEvent = {
            kind: 'polyline-edit',
            layerId: 'MobilityLanes',
            payload: { before, after }
        };

        expect(replay([after], mutation, 'undo')?.features).toEqual([before]);
        expect(replay([before], mutation, 'redo')?.features).toEqual([after]);
    });

    it('requests snapshot fallback for malformed or inapplicable mutations', () => {
        expect(
            replay([], { kind: 'point-batch-delete', layerId: 'ModalFilters', payload: {} }, 'undo')
        ).toBeNull();
        expect(
            replay([], { kind: 'polyline-add', layerId: 'MobilityLanes', payload: {} }, 'redo')
        ).toBeNull();
        expect(
            replay(
                [],
                {
                    kind: 'polyline-edit',
                    layerId: 'MobilityLanes',
                    payload: {
                        historyId: 'missing',
                        beforeCoordinates: [],
                        afterCoordinates: []
                    }
                },
                'undo'
            )
        ).toBeNull();
    });
});
