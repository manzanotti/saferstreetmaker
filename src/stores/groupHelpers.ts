import type { GroupMember, GroupVersion } from '../models/Group';
import { memberKey, reconcilePhases } from '../features/groups/groupVersions';

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
