import { describe, expect, it } from 'vitest';
import { dispatchHistoryReplay } from '../../src/features/history/historyReplayDispatch';
import type { HistoryReplayEntry } from '../../src/services/UndoJournal';

function makeReplay(
    mutationKind?: string,
    mutationLayerId?: string,
    mutationPayload?: unknown
): HistoryReplayEntry {
    return {
        entry: {
            mutationKind,
            mutationLayerId,
            mutationPayload
        },
        snapshot: {} as HistoryReplayEntry['snapshot'],
        direction: 'undo'
    };
}

describe('history replay dispatch', () => {
    it('dispatches point mutations without changing their payload', () => {
        const payload = { lat: 52.5, lng: -1.9 };

        expect(dispatchHistoryReplay(makeReplay('point-add', 'ModalFilters', payload))).toEqual({
            kind: 'feature',
            mutation: { kind: 'point-add', layerId: 'ModalFilters', payload }
        });
    });

    it('normalizes legacy polyline mutation payloads before dispatch', () => {
        const action = dispatchHistoryReplay(
            makeReplay('polyline-add', 'MobilityLanes', {
                coordinates: [
                    [-1.9, 52.5],
                    [-1.8, 52.6]
                ]
            })
        );

        expect(action).toMatchObject({
            kind: 'feature',
            mutation: { kind: 'polyline-add', layerId: 'MobilityLanes' }
        });
        expect(action).not.toEqual({
            kind: 'feature',
            mutation: { kind: 'polyline-add', layerId: 'MobilityLanes', payload: undefined }
        });
    });

    it('dispatches settings mutations separately from feature mutations', () => {
        const payload = { before: { title: 'Before' }, after: { title: 'After' } };

        expect(dispatchHistoryReplay(makeReplay('settings-apply', 'settings', payload))).toEqual({
            kind: 'settings',
            payload
        });
    });

    it('dispatches phase mutations separately from generic snapshots', () => {
        const payload = {
            groupId: 'group-1',
            versionId: 'version-1',
            phaseId: 'phase-1',
            before: [],
            after: [{ id: 'phase-1', members: [] }]
        };

        expect(dispatchHistoryReplay(makeReplay('phase-update', 'groups', payload))).toEqual({
            kind: 'phase',
            mutation: { kind: 'phase-update', layerId: 'groups', payload }
        });
    });

    it('falls back to snapshot replay for unknown or incomplete mutations', () => {
        expect(dispatchHistoryReplay(makeReplay('unknown', 'layer'))).toEqual({
            kind: 'snapshot'
        });
        expect(dispatchHistoryReplay(makeReplay('point-add'))).toEqual({ kind: 'snapshot' });
    });
});
