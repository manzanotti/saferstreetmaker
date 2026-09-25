import { describe, expect, it } from 'vitest';
import {
    createFeatureMembershipIndex,
    findFeatureGroupMemberships,
    findFeatureGroupMembershipsInIndex,
    findFeatureMemberships,
    findFeatureMembershipsInIndex
} from '../../src/features/groups/featureMemberships';

describe('findFeatureMemberships', () => {
    it('lists every group and version containing the feature and marks active versions', () => {
        const member = { layerId: 'MobilityLanes', historyId: 'line-1' };
        const groups = [
            {
                id: 'g1',
                name: 'Town centre',
                versions: [
                    { id: 'v1', name: 'Current', members: [member] },
                    { id: 'v2', name: 'Alternative', members: [{ ...member }] }
                ]
            },
            {
                id: 'g2',
                name: 'School route',
                members: [{ ...member }]
            }
        ];
        const activeVersionIds = { g1: 'v2', g2: 'g2:default' };
        const index = createFeatureMembershipIndex(groups);

        expect(findFeatureMembershipsInIndex(index, activeVersionIds, member)).toEqual([
            {
                groupId: 'g1',
                groupName: 'Town centre',
                versionId: 'v1',
                versionName: 'Current',
                isActive: false
            },
            {
                groupId: 'g1',
                groupName: 'Town centre',
                versionId: 'v2',
                versionName: 'Alternative',
                isActive: true
            },
            {
                groupId: 'g2',
                groupName: 'School route',
                versionId: 'g2:default',
                versionName: 'Default',
                isActive: true
            }
        ]);
        expect(findFeatureMemberships(groups, activeVersionIds, member)).toEqual(
            findFeatureMembershipsInIndex(index, activeVersionIds, member)
        );
    });
});

describe('findFeatureGroupMemberships', () => {
    it('returns one summary per group with all containing versions', () => {
        const member = { layerId: 'MobilityLanes', historyId: 'line-1' };

        expect(
            findFeatureGroupMemberships(
                [
                    {
                        id: 'g1',
                        name: 'Town centre',
                        description: '<p>Slow down</p>',
                        versions: [
                            { id: 'v1', name: 'Current', members: [member] },
                            { id: 'v2', name: 'Alternative', members: [{ ...member }] }
                        ]
                    },
                    {
                        id: 'g2',
                        name: 'School route',
                        members: [{ ...member }]
                    }
                ],
                member
            )
        ).toEqual([
            {
                groupId: 'g1',
                groupName: 'Town centre',
                description: '<p>Slow down</p>',
                versionCount: 2,
                versions: [
                    { id: 'v1', name: 'Current' },
                    { id: 'v2', name: 'Alternative' }
                ]
            },
            {
                groupId: 'g2',
                groupName: 'School route',
                versionCount: 1,
                versions: [{ id: 'g2:default', name: 'Default' }]
            }
        ]);
        const index = createFeatureMembershipIndex([
            {
                id: 'g1',
                name: 'Town centre',
                description: '<p>Slow down</p>',
                versions: [
                    { id: 'v1', name: 'Current', members: [member] },
                    { id: 'v2', name: 'Alternative', members: [{ ...member }] }
                ]
            },
            {
                id: 'g2',
                name: 'School route',
                members: [{ ...member }]
            }
        ]);
        expect(findFeatureGroupMembershipsInIndex(index, member)).toEqual(
            findFeatureGroupMemberships(
                [
                    {
                        id: 'g1',
                        name: 'Town centre',
                        description: '<p>Slow down</p>',
                        versions: [
                            { id: 'v1', name: 'Current', members: [member] },
                            { id: 'v2', name: 'Alternative', members: [{ ...member }] }
                        ]
                    },
                    {
                        id: 'g2',
                        name: 'School route',
                        members: [{ ...member }]
                    }
                ],
                member
            )
        );
    });

    it('ignores groups that do not contain the feature', () => {
        expect(
            findFeatureGroupMemberships([{ id: 'g1', name: 'Other', members: [] }], {
                layerId: 'ModalFilters',
                historyId: 'missing'
            })
        ).toEqual([]);
    });
});
