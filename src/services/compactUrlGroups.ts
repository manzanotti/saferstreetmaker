import type { Group, GroupMember, GroupVersion } from '../models/Group';
import { normalizeGroupDescription } from '../features/groups/groupDescription';

export interface CompactUrlGroup {
    i: string;
    n: string;
    c?: string;
    d?: string;
    p?: string;
    m?: Array<[string, number]>;
    v?: Array<{
        i: string;
        n: string;
        m: Array<[string, number]>;
        p?: Array<{ i: string; m: Array<[string, number]> }>;
    }>;
}

function encodeUrlMembers(
    members: GroupVersion['members'],
    getHistoryIndex: (historyId: string) => number
): Array<[string, number]> {
    return members.map((member) => [member.layerId, getHistoryIndex(member.historyId)]);
}

function decodeUrlMembers(
    members: Array<[string, number]> | undefined,
    historyIds: string[]
): GroupMember[] {
    return (members ?? [])
        .filter((member) => historyIds[member[1]] !== undefined)
        .map(([layerId, historyIndex]) => ({
            layerId,
            historyId: historyIds[historyIndex]
        }));
}

export function encodeUrlGroups(
    groups: Group[] | undefined,
    getHistoryIndex: (historyId: string) => number
): CompactUrlGroup[] | undefined {
    if (!groups || groups.length === 0) {
        return undefined;
    }
    return groups.map((group) => {
        const description = normalizeGroupDescription(group.description);
        if (!group.versions) {
            return {
                i: group.id,
                n: group.name,
                ...(description ? { p: description } : {}),
                ...(group.color ? { c: group.color } : {}),
                m: encodeUrlMembers(group.members ?? [], getHistoryIndex)
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
                m: encodeUrlMembers(version.members, getHistoryIndex),
                ...(version.phases && version.phases.length > 0
                    ? {
                          p: version.phases.map((phase) => ({
                              i: phase.id,
                              m: encodeUrlMembers(phase.members, getHistoryIndex)
                          }))
                      }
                    : {})
            }))
        };
    });
}

export function decodeUrlGroups(
    groups: CompactUrlGroup[] | undefined,
    historyIds: string[]
): Group[] | undefined {
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
                      members: decodeUrlMembers(version.m, historyIds),
                      ...(version.p
                          ? {
                                phases: version.p.map((phase) => ({
                                    id: phase.i,
                                    members: decodeUrlMembers(phase.m, historyIds)
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
                  members: decodeUrlMembers(group.m, historyIds)
              }
    );
}
