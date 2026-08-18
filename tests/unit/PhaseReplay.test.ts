import { describe, expect, it } from 'vitest';
import { getPhaseReplayContext } from '../../src/features/history/phaseReplay';
import type { SerializedMap } from '../../src/services/MapSerializer';
import type { HistoryReplayEntry } from '../../src/services/UndoJournal';

function snapshot(phaseIds: string[]): SerializedMap {
    return {
        groups: [
            {
                id: 'group-1',
                name: 'Group',
                defaultVersionId: 'version-1',
                versions: [
                    {
                        id: 'version-1',
                        name: 'Default',
                        members: [],
                        phases: phaseIds.map((id) => ({ id, members: [] }))
                    }
                ]
            }
        ]
    };
}

function replay(
    before: SerializedMap,
    after: SerializedMap,
    direction: 'undo' | 'redo',
    mutationPayload?: unknown
) {
    return {
        direction,
        snapshot: direction === 'undo' ? before : after,
        entry: {
            mapTitle: 'Map',
            sequence: 1,
            kind: 'checkpoint',
            before,
            after,
            createdAt: new Date().toISOString(),
            mutationKind: mutationPayload ? 'phase-update' : undefined,
            mutationLayerId: mutationPayload ? 'groups' : undefined,
            mutationPayload
        }
    } satisfies HistoryReplayEntry;
}

describe('getPhaseReplayContext', () => {
    it('uses explicit phase metadata without comparing full snapshots', () => {
        const before = snapshot(['phase-1']);
        const after = snapshot(['phase-1', 'phase-2']);
        const payload = {
            groupId: 'group-1',
            versionId: 'version-1',
            phaseId: 'phase-2',
            before: before.groups![0].versions![0].phases!,
            after: after.groups![0].versions![0].phases!
        };

        expect(getPhaseReplayContext(replay(before, after, 'redo', payload), null)).toEqual({
            groupId: 'group-1',
            versionId: 'version-1',
            phaseId: 'phase-2'
        });
    });

    it('selects the affected version and first surviving phase after undo', () => {
        const before = snapshot(['phase-1']);
        const after = snapshot(['phase-1', 'phase-2']);

        expect(getPhaseReplayContext(replay(before, after, 'undo'), null)).toEqual({
            groupId: 'group-1',
            versionId: 'version-1',
            phaseId: 'phase-1'
        });
    });

    it('preserves the focused phase when it survives redo', () => {
        const before = snapshot(['phase-1']);
        const after = snapshot(['phase-1', 'phase-2']);

        expect(
            getPhaseReplayContext(replay(before, after, 'redo'), {
                groupId: 'group-1',
                versionId: 'version-1',
                phaseId: 'phase-1'
            })
        ).toEqual({
            groupId: 'group-1',
            versionId: 'version-1',
            phaseId: 'phase-1'
        });
    });

    it('detects membership changes when the phase count is unchanged', () => {
        const before = snapshot(['phase-1']);
        const after = snapshot(['phase-1']);
        after.groups![0].versions![0].phases![0].members = [
            { layerId: 'ModalFilters', historyId: 'filter-1' }
        ];

        expect(getPhaseReplayContext(replay(before, after, 'redo'), null)).toEqual({
            groupId: 'group-1',
            versionId: 'version-1',
            phaseId: 'phase-1'
        });
    });

    it('ignores checkpoints that do not change phases', () => {
        const state = snapshot(['phase-1']);

        expect(getPhaseReplayContext(replay(state, state, 'undo'), null)).toBeNull();
    });
});
