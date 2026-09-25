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

export type FeatureMembershipIndex = Map<string, FeatureGroupMembershipSummary[]>;

export function createFeatureMembershipIndex(groups: Group[]): FeatureMembershipIndex {
    const index: FeatureMembershipIndex = new Map();

    for (const group of groups) {
        const versions = getGroupVersions(group);
        const membershipsByMember = new Map<string, Array<{ id: string; name: string }>>();
        for (const version of versions) {
            const versionMembers = new Set(version.members.map(memberKey));
            for (const key of versionMembers) {
                const containingVersions = membershipsByMember.get(key) ?? [];
                containingVersions.push({ id: version.id, name: version.name });
                membershipsByMember.set(key, containingVersions);
            }
        }

        for (const [key, containingVersions] of membershipsByMember) {
            const summaries = index.get(key) ?? [];
            summaries.push({
                groupId: group.id,
                groupName: group.name,
                ...(group.description ? { description: group.description } : {}),
                versionCount: versions.length,
                versions: containingVersions
            });
            index.set(key, summaries);
        }
    }

    return index;
}

export function findFeatureMembershipsInIndex(
    index: FeatureMembershipIndex,
    activeVersionIds: Record<string, string>,
    member: GroupMember
): FeatureMembershipLocation[] {
    return (index.get(memberKey(member)) ?? []).flatMap((group) =>
        group.versions.map((version) => ({
            groupId: group.groupId,
            groupName: group.groupName,
            versionId: version.id,
            versionName: version.name,
            isActive: activeVersionIds[group.groupId] === version.id
        }))
    );
}

export function findFeatureGroupMembershipsInIndex(
    index: FeatureMembershipIndex,
    member: GroupMember
): FeatureGroupMembershipSummary[] {
    return (index.get(memberKey(member)) ?? []).map((group) => ({
        ...group,
        versions: group.versions.map((version) => ({ ...version }))
    }));
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
