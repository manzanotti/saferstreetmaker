import type { HistoryReplayEntry } from '../../services/UndoJournal';
import type { LayerMutationEvent } from '../../models/LayerMutation';
import { normaliseFeatureMutationPayload } from './mutationPayload';

export type HistoryReplayAction =
    | { kind: 'feature'; mutation: LayerMutationEvent }
    | { kind: 'phase'; mutation: LayerMutationEvent }
    | { kind: 'settings'; payload?: unknown }
    | { kind: 'snapshot' };

export function dispatchHistoryReplay(replay: HistoryReplayEntry): HistoryReplayAction {
    const mutationKind = replay.entry.mutationKind;
    const mutationLayerId = replay.entry.mutationLayerId;
    const mutationPayload = replay.entry.mutationPayload;

    if (
        mutationKind &&
        mutationLayerId &&
        (mutationKind === 'point-add' ||
            mutationKind === 'point-delete' ||
            mutationKind === 'point-batch-delete')
    ) {
        return {
            kind: 'feature',
            mutation: {
                kind: mutationKind,
                layerId: mutationLayerId,
                payload: mutationPayload
            }
        };
    }

    if (
        mutationKind &&
        mutationLayerId &&
        (mutationKind === 'polyline-add' ||
            mutationKind === 'polyline-delete' ||
            mutationKind === 'polyline-edit' ||
            mutationKind === 'polyline-vertices-delete' ||
            mutationKind === 'polygon-add' ||
            mutationKind === 'polygon-delete' ||
            mutationKind === 'polygon-batch-delete' ||
            mutationKind === 'polygon-edit')
    ) {
        return {
            kind: 'feature',
            mutation: {
                kind: mutationKind,
                layerId: mutationLayerId,
                payload: normaliseFeatureMutationPayload(mutationKind, mutationPayload)
            }
        };
    }

    if (mutationKind === 'settings-apply') {
        return { kind: 'settings', payload: mutationPayload };
    }

    if (mutationKind === 'phase-update' && mutationLayerId === 'groups') {
        return {
            kind: 'phase',
            mutation: {
                kind: mutationKind,
                layerId: mutationLayerId,
                payload: mutationPayload
            }
        };
    }

    return { kind: 'snapshot' };
}
