import type { Group, GroupMember, GroupPhase, GroupVersion } from '../../models/Group';
import { normalizeGroupDescription } from './groupDescription';

export interface NormalizedGroup {
    id: string;
    name: string;
    description?: string;
    color?: string;
    defaultVersionId: string;
    versions: GroupVersion[];
    members: GroupMember[];
}

function uniqueMembers(members: GroupMember[]): GroupMember[] {
    return Array.from(
        new Map(members.map((member) => [memberKey(member), { ...member }])).values()
    );
}

export function normalizePhases(phases: GroupPhase[] | undefined): GroupPhase[] {
    return (phases ?? []).map((phase) => ({
        id: phase.id,
        members: uniqueMembers(phase.members ?? [])
    }));
}

export function reconcilePhases(
    phases: GroupPhase[] | undefined,
    versionMembers: GroupMember[]
): GroupPhase[] {
    const versionMemberKeys = new Set(versionMembers.map(memberKey));
    return normalizePhases(phases).map((phase) => ({
        ...phase,
        members: phase.members.filter((member) => versionMemberKeys.has(memberKey(member)))
    }));
}

export function getPhasedMemberKeys(version: GroupVersion): Set<string> {
    return new Set(
        normalizePhases(version.phases).flatMap((phase) => phase.members.map(memberKey))
    );
}

export function getNewPhaseDraftMembers(version: GroupVersion): GroupMember[] {
    const phasedMemberKeys = getPhasedMemberKeys(version);
    return version.members
        .filter((member) => !phasedMemberKeys.has(memberKey(member)))
        .map((member) => ({ ...member }));
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

export function needsReadOnlyGroupDetails(group: Group): boolean {
    const versions = getGroupVersions(group);
    return versions.length > 1 || versions.some((version) => (version.phases?.length ?? 0) > 0);
}

export function normalizeGroup(group: Group): NormalizedGroup {
    const versions = getGroupVersions(group).map((version) => ({
        id: version.id,
        name: version.name,
        members: version.members.map((member) => ({ ...member })),
        ...(version.phases !== undefined
            ? { phases: reconcilePhases(version.phases, version.members) }
            : {})
    }));
    const defaultVersionId = versions.some((version) => version.id === group.defaultVersionId)
        ? group.defaultVersionId!
        : versions[0].id;

    return {
        id: group.id,
        name: group.name,
        ...(normalizeGroupDescription(group.description)
            ? { description: normalizeGroupDescription(group.description) }
            : {}),
        ...(group.color ? { color: group.color } : {}),
        defaultVersionId,
        versions,
        members: [...versions.find((version) => version.id === defaultVersionId)!.members]
    };
}

export function normalizeGroups(groups: Group[] | undefined): NormalizedGroup[] {
    return (groups ?? []).map(normalizeGroup);
}

export function featureKey(layerId: string, historyId: string): string {
    return `${layerId}:${historyId}`;
}

export function memberKey(member: GroupMember): string {
    return featureKey(member.layerId, member.historyId);
}

export function hasVersionName(group: Group, name: string, excludedVersionId?: string): boolean {
    const normalizedName = name.trim().toLowerCase();
    return getGroupVersions(group).some(
        (version) =>
            version.id !== excludedVersionId && version.name.trim().toLowerCase() === normalizedName
    );
}
