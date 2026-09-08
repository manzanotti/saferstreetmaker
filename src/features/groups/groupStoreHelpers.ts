import type { Group, GroupMember, GroupVersion } from '../../models/Group';
import { memberKey, normalizeGroup, reconcilePhases } from './groupVersions';
import { normalizeGroupDescription } from './groupDescription';

export function uniqueMembers(members: GroupMember[]): GroupMember[] {
    return Array.from(new Map(members.map((member) => [memberKey(member), member])).values());
}

export function withMembers(version: GroupVersion, members: GroupMember[]): GroupVersion {
    const nextMembers = uniqueMembers(members).map((member) => ({ ...member }));
    return {
        ...version,
        members: nextMembers,
        ...(version.phases !== undefined
            ? { phases: reconcilePhases(version.phases, nextMembers) }
            : {})
    };
}

export function normalizeStoredGroup(group: Group): Group {
    if (group.versions) {
        return normalizeGroup(group);
    }

    const description = normalizeGroupDescription(group.description);
    return {
        ...group,
        ...(description ? { description } : { description: undefined }),
        members: [...(group.members ?? [])]
    };
}
