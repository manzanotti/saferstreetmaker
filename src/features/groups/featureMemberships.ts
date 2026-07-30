import type { Group, GroupMember } from '../../models/Group';
import { getGroupVersions, memberKey } from './groupVersions';

export interface FeatureMembershipLocation {
    groupId: string;
    groupName: string;
    versionId: string;
    versionName: string;
    isActive: boolean;
}

export interface FeatureGroupMembershipSummary {
    groupId: string;
    groupName: string;
    description?: string;
    versionCount: number;
    versions: Array<{ id: string; name: string }>;
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

export function findFeatureGroupMemberships(
    groups: Group[],
    member: GroupMember
): FeatureGroupMembershipSummary[] {
    const targetKey = memberKey(member);

    return groups.flatMap((group) => {
        const versions = getGroupVersions(group);
        const containingVersions = versions
            .filter((version) =>
                version.members.some((versionMember) => memberKey(versionMember) === targetKey)
            )
            .map((version) => ({ id: version.id, name: version.name }));

        if (containingVersions.length === 0) {
            return [];
        }

        return [
            {
                groupId: group.id,
                groupName: group.name,
                ...(group.description ? { description: group.description } : {}),
                versionCount: versions.length,
                versions: containingVersions
            }
        ];
    });
}
