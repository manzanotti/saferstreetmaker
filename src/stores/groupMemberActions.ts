import type { Ref } from 'vue';
import type { Group, GroupMember } from '../models/Group';
import { getActiveVersion, getGroupVersions, memberKey } from '../features/groups/groupVersions';
import { uniqueMembers, withMembers } from './groupHelpers';

export function createGroupMemberActions(
    groups: Ref<Group[]>,
    activeVersionIds: Ref<Record<string, string>>
) {
    function addMembersToGroup(id: string, members: GroupMember[]) {
        groups.value = groups.value.map((g) => {
            if (g.id !== id) {
                return g;
            }
            const activeVersion = getActiveVersion(g, activeVersionIds.value[id]);
            const existingKeys = new Set(activeVersion.members.map(memberKey));
            const toAdd = uniqueMembers(members).filter((m) => !existingKeys.has(memberKey(m)));
            return {
                ...g,
                versions: getGroupVersions(g).map((version) =>
                    version.id === activeVersion.id
                        ? { ...version, members: [...version.members, ...toAdd] }
                        : version
                ),
                members: [...activeVersion.members, ...toAdd]
            };
        });
    }

    function replaceActiveVersionMembers(id: string, members: GroupMember[]): boolean {
        const group = groups.value.find((item) => item.id === id);
        if (!group) {
            return false;
        }

        const activeVersion = getActiveVersion(group, activeVersionIds.value[id]);
        const nextMembers = uniqueMembers(members).map((member) => ({ ...member }));
        groups.value = groups.value.map((item) =>
            item.id === id
                ? {
                      ...item,
                      versions: getGroupVersions(item).map((version) =>
                          version.id === activeVersion.id
                              ? withMembers(version, nextMembers)
                              : version
                      ),
                      members: [...nextMembers]
                  }
                : item
        );
        return true;
    }

    function replaceVersionMember(
        groupId: string,
        versionId: string,
        currentMember: GroupMember,
        replacementMember: GroupMember
    ): boolean {
        const group = groups.value.find((item) => item.id === groupId);
        const version = group
            ? getGroupVersions(group).find((item) => item.id === versionId)
            : undefined;
        const currentKey = memberKey(currentMember);
        if (
            !group ||
            !version ||
            !version.members.some((member) => memberKey(member) === currentKey)
        ) {
            return false;
        }

        const nextMembers = uniqueMembers(
            version.members.map((member) =>
                memberKey(member) === currentKey ? { ...replacementMember } : member
            )
        );
        const nextPhases = version.phases?.map((phase) => ({
            ...phase,
            members: phase.members.map((member) =>
                memberKey(member) === currentKey ? { ...replacementMember } : member
            )
        }));
        groups.value = groups.value.map((item) =>
            item.id === groupId
                ? {
                      ...item,
                      versions: getGroupVersions(item).map((itemVersion) =>
                          itemVersion.id === versionId
                              ? withMembers(
                                    {
                                        ...itemVersion,
                                        ...(nextPhases ? { phases: nextPhases } : {})
                                    },
                                    nextMembers
                                )
                              : itemVersion
                      ),
                      members:
                          activeVersionIds.value[groupId] === versionId
                              ? [...nextMembers]
                              : item.members
                  }
                : item
        );
        return true;
    }

    function removeMemberFromVersions(
        groupId: string,
        versionIds: string[],
        member: GroupMember
    ): boolean {
        const group = groups.value.find((item) => item.id === groupId);
        if (!group) {
            return false;
        }
        const targetVersionIds = new Set(versionIds);
        const targetKey = memberKey(member);
        const versions = getGroupVersions(group);
        if (
            !versions.some(
                (version) =>
                    targetVersionIds.has(version.id) &&
                    version.members.some((item) => memberKey(item) === targetKey)
            )
        ) {
            return false;
        }

        const nextVersions = versions.map((version) =>
            targetVersionIds.has(version.id)
                ? withMembers(
                      version,
                      version.members.filter((item) => memberKey(item) !== targetKey)
                  )
                : version
        );
        const activeVersionId = activeVersionIds.value[groupId];
        groups.value = groups.value.map((item) =>
            item.id === groupId
                ? {
                      ...item,
                      versions: nextVersions,
                      members: [
                          ...(nextVersions.find((version) => version.id === activeVersionId)
                              ?.members ?? [])
                      ]
                  }
                : item
        );
        return true;
    }

    function clearGroupMembers(id: string) {
        groups.value = groups.value.map((g) => {
            if (g.id !== id) {
                return g;
            }
            const activeVersion = getActiveVersion(g, activeVersionIds.value[id]);
            return {
                ...g,
                versions: getGroupVersions(g).map((version) =>
                    version.id === activeVersion.id ? withMembers(version, []) : version
                ),
                members: []
            };
        });
    }

    return {
        addMembersToGroup,
        replaceActiveVersionMembers,
        replaceVersionMember,
        removeMemberFromVersions,
        clearGroupMembers
    };
}
