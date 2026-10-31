import type { Ref } from 'vue';
import type { Group, GroupPhase, GroupVersion } from '../../models/Group';
import {
    getActiveVersion,
    getDefaultVersionId,
    getGroupVersions,
    getUnassignedGroupMembers,
    hasVersionName,
    memberKey,
    reconcilePhases
} from './groupVersions';
import { withMembers } from './groupStoreHelpers';

export function createGroupStoreVersionActions(
    groups: Ref<Group[]>,
    activeVersionIds: Ref<Record<string, string>>,
    phaseGroupId: Ref<string | null>,
    phaseVersionId: Ref<string | null>,
    closePhasesDialog: () => void
) {
    function getActiveGroupVersion(id: string): GroupVersion | null {
        const group = groups.value.find((item) => item.id === id);
        return group ? getActiveVersion(group, activeVersionIds.value[id]) : null;
    }

    function setActiveVersion(groupId: string, versionId: string): boolean {
        const group = groups.value.find((item) => item.id === groupId);
        if (!group || !getGroupVersions(group).some((version) => version.id === versionId)) {
            return false;
        }
        activeVersionIds.value = { ...activeVersionIds.value, [groupId]: versionId };
        groups.value = groups.value.map((item) =>
            item.id === groupId
                ? { ...item, members: [...getActiveVersion(item, versionId).members] }
                : item
        );
        return true;
    }

    function addVersion(groupId: string, version: GroupVersion): boolean {
        const group = groups.value.find((item) => item.id === groupId);
        if (!group || !version.name.trim() || hasVersionName(group, version.name)) {
            return false;
        }
        const defaultVersionId = getDefaultVersionId(group);
        const assignedKeys = new Set(version.members.map(memberKey));
        groups.value = groups.value.map((item) =>
            item.id === groupId
                ? {
                      ...item,
                      versions: [...getGroupVersions(item), withMembers(version, version.members)],
                      ...(item.unassignedMembers
                          ? {
                                unassignedMembers: getUnassignedGroupMembers(item).filter(
                                    (member) => !assignedKeys.has(memberKey(member))
                                )
                            }
                          : {}),
                      defaultVersionId
                  }
                : item
        );
        return true;
    }

    function renameVersion(groupId: string, versionId: string, name: string): boolean {
        const group = groups.value.find((item) => item.id === groupId);
        if (!group || !name.trim() || hasVersionName(group, name, versionId)) {
            return false;
        }
        groups.value = groups.value.map((item) =>
            item.id === groupId
                ? {
                      ...item,
                      versions: getGroupVersions(item).map((version) =>
                          version.id === versionId ? { ...version, name: name.trim() } : version
                      ),
                      members: item.members
                  }
                : item
        );
        return true;
    }

    function setDefaultVersion(groupId: string, versionId: string): boolean {
        const group = groups.value.find((item) => item.id === groupId);
        if (!group || !getGroupVersions(group).some((version) => version.id === versionId)) {
            return false;
        }
        groups.value = groups.value.map((item) =>
            item.id === groupId ? { ...item, defaultVersionId: versionId } : item
        );
        return true;
    }

    function removeVersion(
        groupId: string,
        versionId: string,
        keepMembers = false
    ): GroupVersion | null {
        const group = groups.value.find((item) => item.id === groupId);
        if (!group) {
            return null;
        }
        const versions = getGroupVersions(group);
        if (versions.length <= 1 || !versions.some((version) => version.id === versionId)) {
            return null;
        }
        const remaining = versions.filter((version) => version.id !== versionId);
        const removed = versions.find((version) => version.id === versionId)!;
        const unassignedMembers = getUnassignedGroupMembers({
            ...group,
            versions: remaining,
            unassignedMembers: [
                ...(group.unassignedMembers ?? []),
                ...(keepMembers ? removed.members : [])
            ]
        });
        const currentDefault = getDefaultVersionId(group);
        const nextDefault = currentDefault === versionId ? remaining[0].id : currentDefault;
        groups.value = groups.value.map((item) =>
            item.id === groupId
                ? {
                      ...item,
                      versions: remaining,
                      ...(keepMembers || item.unassignedMembers ? { unassignedMembers } : {}),
                      defaultVersionId: nextDefault,
                      members:
                          activeVersionIds.value[groupId] === versionId
                              ? [
                                    ...remaining.find((version) => version.id === nextDefault)!
                                        .members
                                ]
                              : item.members
                  }
                : item
        );
        if (activeVersionIds.value[groupId] === versionId) {
            activeVersionIds.value = { ...activeVersionIds.value, [groupId]: nextDefault };
        }
        if (phaseGroupId.value === groupId && phaseVersionId.value === versionId) {
            closePhasesDialog();
        }
        return versions.find((version) => version.id === versionId) ?? null;
    }

    function replaceVersionPhases(
        groupId: string,
        versionId: string,
        phases: GroupPhase[]
    ): boolean {
        const group = groups.value.find((item) => item.id === groupId);
        if (!group || !getGroupVersions(group).some((version) => version.id === versionId)) {
            return false;
        }

        groups.value = groups.value.map((item) =>
            item.id === groupId
                ? {
                      ...item,
                      versions: getGroupVersions(item).map((version) =>
                          version.id === versionId
                              ? {
                                    ...version,
                                    phases: reconcilePhases(phases, version.members)
                                }
                              : version
                      )
                  }
                : item
        );
        return true;
    }

    function reorderVersionPhases(groupId: string, versionId: string, phaseIds: string[]): boolean {
        const group = groups.value.find((item) => item.id === groupId);
        const version = group
            ? getGroupVersions(group).find((item) => item.id === versionId)
            : undefined;
        if (
            !version ||
            phaseIds.length !== (version.phases ?? []).length ||
            new Set(phaseIds).size !== phaseIds.length
        ) {
            return false;
        }

        const phasesById = new Map((version.phases ?? []).map((phase) => [phase.id, phase]));
        if (phaseIds.some((phaseId) => !phasesById.has(phaseId))) {
            return false;
        }

        return replaceVersionPhases(
            groupId,
            versionId,
            phaseIds.map((phaseId) => phasesById.get(phaseId)!)
        );
    }

    return {
        getActiveGroupVersion,
        setActiveVersion,
        addVersion,
        renameVersion,
        setDefaultVersion,
        removeVersion,
        replaceVersionPhases,
        reorderVersionPhases
    };
}
