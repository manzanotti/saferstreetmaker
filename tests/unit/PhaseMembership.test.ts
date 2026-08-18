import { describe, expect, it } from 'vitest';
import { applyPhaseSelectionDelta } from '../../src/features/groups/phaseMembership';

describe('applyPhaseSelectionDelta', () => {
    it('removes only the two deselected LTN cells from a 16-member phase', () => {
        const points = Array.from({ length: 14 }, (_, index) => ({
            layerId: 'ModalFilters',
            historyId: `point-${index}`
        }));
        const ltnMembers = [
            { layerId: 'LtnCells', historyId: 'ltn-1' },
            { layerId: 'LtnCells', historyId: 'ltn-2' }
        ];

        const result = applyPhaseSelectionDelta(
            [...points, ...ltnMembers],
            [],
            new Set(['LtnCells:ltn-1', 'LtnCells:ltn-2'])
        );

        expect(result).toEqual(points);
    });

    it('adds newly selected members and removes only members deselected since the last update', () => {
        const result = applyPhaseSelectionDelta(
            [
                { layerId: 'ModalFilters', historyId: 'untouched-point' },
                { layerId: 'LtnCells', historyId: 'ltn-1' }
            ],
            [{ layerId: 'ModalFilters', historyId: 'new-point' }],
            new Set(['LtnCells:ltn-1'])
        );

        expect(result).toEqual([
            { layerId: 'ModalFilters', historyId: 'untouched-point' },
            { layerId: 'ModalFilters', historyId: 'new-point' }
        ]);
    });
});
