import { describe, expect, it, vi } from 'vitest';

vi.mock('leaflet', () => import('./__mocks__/leaflet'));

import { markPhaseMutation } from '../../src/composables/groups/groupRuntime';
import { pinia } from '../../src/stores';
import { useMapStore } from '../../src/stores/mapStore';

describe('group phase history', () => {
    it('captures independent before and after phase snapshots', () => {
        const before = [
            { id: 'phase', members: [{ layerId: 'ModalFilters', historyId: 'before' }] }
        ];
        const after = [{ id: 'phase', members: [{ layerId: 'ModalFilters', historyId: 'after' }] }];
        markPhaseMutation('group', 'version', 'phase', before, after);
        before[0].members[0].historyId = 'changed';
        after[0].members.push({ layerId: 'ModalFilters', historyId: 'later' });

        expect(useMapStore(pinia).lastLayerMutation).toMatchObject({
            kind: 'phase-update',
            layerId: 'groups',
            payload: {
                groupId: 'group',
                versionId: 'version',
                phaseId: 'phase',
                before: [{ id: 'phase', members: [{ historyId: 'before' }] }],
                after: [{ id: 'phase', members: [{ historyId: 'after' }] }]
            }
        });
    });
});
