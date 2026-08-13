import { describe, expect, it } from 'vitest';
import type { Group } from '../../src/models/Group';
import {
    getNewPhaseDraftMembers,
    getActiveVersion,
    getDefaultVersionId,
    hasVersionName,
    normalizeGroup
} from '../../src/features/groups/groupVersions';

const legacyGroup: Group = {
    id: 'group-1',
    name: 'School Zone',
    members: [{ layerId: 'ModalFilters', historyId: 'feature-1' }]
};

describe('group version helpers', () => {
    it('normalizes a legacy group into a deterministic default version', () => {
        const normalized = normalizeGroup(legacyGroup);

        expect(normalized.defaultVersionId).toBe('group-1:default');
        expect(normalized.versions).toEqual([
            {
                id: 'group-1:default',
                name: 'Default',
                members: [{ layerId: 'ModalFilters', historyId: 'feature-1' }]
            }
        ]);
        expect(normalized.members).toEqual(legacyGroup.members);
        expect(normalized.members).not.toBe(legacyGroup.members);
    });

    it('falls back to the first version when the default id is missing', () => {
        const group: Group = {
            id: 'group-2',
            name: 'Main Street',
            defaultVersionId: 'missing',
            versions: [
                { id: 'v1', name: 'Existing', members: [] },
                { id: 'v2', name: 'Alternative', members: [] }
            ]
        };

        expect(getDefaultVersionId(group)).toBe('v1');
        expect(getActiveVersion(group, 'v2').id).toBe('v2');
        expect(getActiveVersion(group, 'missing').id).toBe('v1');
    });

    it('starts the first phase with all members and later phases with unassigned members', () => {
        const members = [
            { layerId: 'ModalFilters', historyId: 'feature-1' },
            { layerId: 'ModalFilters', historyId: 'feature-2' },
            { layerId: 'ModalFilters', historyId: 'feature-3' }
        ];
        const version = {
            id: 'v1',
            name: 'Base',
            members,
            phases: [{ id: 'phase-1', members: [members[0]] }]
        };

        expect(getNewPhaseDraftMembers({ ...version, phases: [] })).toEqual(members);
        expect(getNewPhaseDraftMembers(version)).toEqual([members[1], members[2]]);
    });

    it('normalizes missing phases without changing legacy group membership', () => {
        const normalized = normalizeGroup(legacyGroup);

        expect(normalized.versions[0].phases).toBeUndefined();
        expect(normalized.versions[0].members).toEqual(legacyGroup.members);
    });

    it('compares version names case-insensitively while allowing the current name', () => {
        const group: Group = {
            id: 'group-3',
            name: 'Centre',
            versions: [
                { id: 'v1', name: 'Base', members: [] },
                { id: 'v2', name: 'Plan B', members: [] }
            ]
        };

        expect(hasVersionName(group, ' plan b ')).toBe(true);
        expect(hasVersionName(group, ' plan b ', 'v2')).toBe(false);
        expect(hasVersionName(group, 'Plan C')).toBe(false);
    });
});
