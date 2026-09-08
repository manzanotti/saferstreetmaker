import type { Group, GroupMember, GroupPhase, GroupVersion } from '../models/Group';
import { normalizeGroupDescription } from '../features/groups/groupDescription';

export interface CompactGroup {
    i: string;
    n: string;
    c?: string;
    m?: Array<[string, string]>;
    d?: string;
    p?: string;
    v?: Array<{
        i: string;
        n: string;
        m: Array<[string, string]>;
        p?: Array<{ i: string; m: Array<[string, string]> }>;
    }>;
}

function serializeMembers(members: GroupVersion['members']): Array<[string, string]> {
    return members.map((member) => [member.layerId, member.historyId]);
}

function serializePhases(phases: GroupPhase[] | undefined): Array<{
    i: string;
    m: Array<[string, string]>;
}> {
    return (phases ?? []).map((phase) => ({
        i: phase.id,
        m: serializeMembers(phase.members)
    }));
}

function serializeGroup(group: Group): CompactGroup {
    const description = normalizeGroupDescription(group.description);
    if (!group.versions) {
        return {
            i: group.id,
            n: group.name,
            ...(description ? { p: description } : {}),
            ...(group.color ? { c: group.color } : {}),
            m: serializeMembers(group.members ?? [])
        };
    }
    return {
        i: group.id,
        n: group.name,
        ...(description ? { p: description } : {}),
        ...(group.color ? { c: group.color } : {}),
        d: group.defaultVersionId,
        v: group.versions.map((version) => ({
            i: version.id,
            n: version.name,
            m: serializeMembers(version.members),
            ...(version.phases && version.phases.length > 0
                ? { p: serializePhases(version.phases) }
                : {})
        }))
    };
}

export function serializeCompactGroups(groups: Group[] | undefined): CompactGroup[] | undefined {
    if (!groups || groups.length === 0) {
        return undefined;
    }
    return groups.map(serializeGroup);
}

function deserializeMembers(members: Array<[string, string]> | undefined): GroupMember[] {
    return (members ?? []).map(([layerId, historyId]) => ({ layerId, historyId }));
}

export function deserializeCompactGroups(groups: CompactGroup[] | undefined): Group[] | undefined {
    if (!groups || groups.length === 0) {
        return undefined;
    }
    return groups.map((group) =>
        group.v
            ? {
                  id: group.i,
                  name: group.n,
                  ...(group.p ? { description: group.p } : {}),
                  ...(group.c ? { color: group.c } : {}),
                  defaultVersionId: group.d,
                  versions: group.v.map((version) => ({
                      id: version.i,
                      name: version.n,
                      members: deserializeMembers(version.m),
                      ...(version.p
                          ? {
                                phases: version.p.map((phase) => ({
                                    id: phase.i,
                                    members: deserializeMembers(phase.m)
                                }))
                            }
                          : {})
                  }))
              }
            : {
                  id: group.i,
                  name: group.n,
                  ...(group.p ? { description: group.p } : {}),
                  ...(group.c ? { color: group.c } : {}),
                  members: deserializeMembers(group.m)
              }
    );
}
