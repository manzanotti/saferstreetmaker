import { describe, expect, it } from 'vitest';
import { findFeatureMemberships } from '../../src/features/groups/featureMemberships';

describe('findFeatureMemberships', () => {
    it('lists every group and version containing the feature and marks active versions', () => {
        const member = { layerId: 'MobilityLanes', historyId: 'line-1' };

        expect(
            findFeatureMemberships(
                [
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
                ],
                { g1: 'v2', g2: 'g2:default' },
                member
            )
        ).toEqual([
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
    });
});
