import type { Group, GroupMember } from '../../models/Group';
import { getGroupVersions, memberKey } from './groupVersions';

export interface FeatureMembershipLocation {
    groupId: string;
    groupName: string;
    versionId: string;
    versionName: string;
    isActive: boolean;
}

export function findFeatureMemberships(
    groups: Group[],
    activeVersionIds: Record<string, string>,
    member: GroupMember
): FeatureMembershipLocation[] {
    const targetKey = memberKey(member);
    return groups.flatMap((group) =>
        getGroupVersions(group)
            .filter((version) =>
                version.members.some((versionMember) => memberKey(versionMember) === targetKey)
            )
            .map((version) => ({
                groupId: group.id,
                groupName: group.name,
                versionId: version.id,
                versionName: version.name,
                isActive: activeVersionIds[group.id] === version.id
            }))
    );
}

export function membershipKey(membership: FeatureMembershipLocation): string {
    return `${membership.groupId}:${membership.versionId}`;
}
