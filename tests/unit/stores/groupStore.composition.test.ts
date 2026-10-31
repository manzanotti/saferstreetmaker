import { createPinia } from 'pinia';
import { describe, expect, it } from 'vitest';
import { useGroupStore } from '../../../src/stores/groupStore';

describe('group store composition', () => {
    it('keeps extracted state and actions visible to Pinia and closes stale phase ownership', () => {
        const store = useGroupStore(createPinia());
        const actions: string[] = [];
        const unsubscribe = store.$onAction(({ name }) => actions.push(name));
        const member = { layerId: 'ModalFilters', historyId: 'one' };
        store.setGroups([
            {
                id: 'group',
                name: 'Group',
                defaultVersionId: 'v1',
                versions: [
                    { id: 'v1', name: 'First', members: [member] },
                    { id: 'v2', name: 'Second', members: [] }
                ]
            }
        ]);
        store.cycleVisibility('group');
        store.cycleVisibility('group');
        expect(store.soloGroupId).toBe('group');

        store.openPhasesDialog('group', 'v2');
        store.$patch({ playbackPlaying: true });
        expect(store.$state.phaseVersionId).toBe('v2');
        expect(store.$state.playbackPlaying).toBe(true);
        expect(store.setActiveVersion('group', 'v2')).toBe(true);
        expect(store.soloGroupId).toBeNull();
        expect(store.groups[0].members).toEqual([]);

        expect(store.removeVersion('group', 'v2')).not.toBeNull();
        expect(store.activeVersionIds.group).toBe('v1');
        expect(store.groups[0].members).toEqual([member]);
        expect(store.$state.phaseGroupId).toBeNull();
        expect(store.$state.playbackPlaying).toBe(false);
        expect(actions).toEqual(
            expect.arrayContaining([
                'setGroups',
                'cycleVisibility',
                'openPhasesDialog',
                'removeVersion'
            ])
        );
        unsubscribe();
    });
});
