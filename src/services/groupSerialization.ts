/**
 * groupSerialization
 *
 * Helpers for converting in-memory `Group` structures to/from the plain
 * (non-compact) serialisation shapes used by `MapSerializer`.
 */
import type { Group, GroupPhase, GroupVersion } from '../models/Group';
import { normalizeGroupDescription } from '../features/groups/groupDescription';

export function serializeMembers(members: GroupVersion['members']): Array<[string, string]> {
    return members.map((member) => [member.layerId, member.historyId]);
}

export function serializePhases(phases: GroupPhase[] | undefined): GroupPhase[] {
    return (phases ?? []).map((phase) => ({
        id: phase.id,
        members: phase.members.map((member) => ({ ...member }))
    }));
}

export function serializeGroup(group: Group): Group {
    const description = normalizeGroupDescription(group.description);
    if (!group.versions) {
        return {
            id: group.id,
            name: group.name,
            ...(description ? { description } : {}),
            ...(group.color ? { color: group.color } : {}),
            members: (group.members ?? []).map((member) => ({ ...member }))
        };
    }
    return {
        id: group.id,
        name: group.name,
        ...(description ? { description } : {}),
        ...(group.color ? { color: group.color } : {}),
        defaultVersionId: group.defaultVersionId,
        versions: group.versions.map((version) => ({
            id: version.id,
            name: version.name,
            members: version.members.map((member) => ({ ...member })),
            ...(version.phases !== undefined ? { phases: serializePhases(version.phases) } : {})
        }))
    };
}

export function deserializeCompactMembers(members: Array<[string, string]> | undefined) {
    return (members ?? []).map(([layerId, historyId]) => ({ layerId, historyId }));
}
