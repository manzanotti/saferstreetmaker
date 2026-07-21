import type { Group, GroupMember, GroupVersion } from '../../models/Group';

export interface NormalizedGroup {
    id: string;
    name: string;
    defaultVersionId: string;
    versions: GroupVersion[];
    members: GroupMember[];
}

export function getGroupVersions(group: Group): GroupVersion[] {
    if (group.versions && group.versions.length > 0) {
        return group.versions;
    }

    return [
        {
            id: `${group.id}:default`,
            name: 'Default',
            members: [...(group.members ?? [])]
        }
    ];
}

export function getDefaultVersionId(group: Group): string {
    const versions = getGroupVersions(group);
    return versions.some((version) => version.id === group.defaultVersionId)
        ? group.defaultVersionId!
        : versions[0].id;
}

export function getActiveVersion(group: Group, activeVersionId?: string | null): GroupVersion {
    const versions = getGroupVersions(group);
    const requestedId = activeVersionId ?? getDefaultVersionId(group);
    return versions.find((version) => version.id === requestedId) ?? versions[0];
}

export function normalizeGroup(group: Group): NormalizedGroup {
    const versions = getGroupVersions(group).map((version) => ({
        id: version.id,
        name: version.name,
        members: version.members.map((member) => ({ ...member }))
    }));
    const defaultVersionId = versions.some((version) => version.id === group.defaultVersionId)
        ? group.defaultVersionId!
        : versions[0].id;

    return {
        id: group.id,
        name: group.name,
        defaultVersionId,
        versions,
        members: [...versions.find((version) => version.id === defaultVersionId)!.members]
    };
}

export function normalizeGroups(groups: Group[] | undefined): NormalizedGroup[] {
    return (groups ?? []).map(normalizeGroup);
}

export function memberKey(member: GroupMember): string {
    return `${member.layerId}:${member.historyId}`;
}

export function hasVersionName(group: Group, name: string, excludedVersionId?: string): boolean {
    const normalizedName = name.trim().toLocaleLowerCase();
    return getGroupVersions(group).some(
        (version) =>
            version.id !== excludedVersionId &&
            version.name.trim().toLocaleLowerCase() === normalizedName
    );
}
