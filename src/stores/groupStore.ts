import { defineStore } from 'pinia';
import { ref, shallowRef } from 'vue';
import type {
    Group,
    GroupMember,
    GroupPhase,
    GroupVersion,
    PartialPolylineSplit
} from '../models/Group';
import {
    getActiveVersion,
    getDefaultVersionId,
    getGroupVersions,
    hasVersionName,
    memberKey,
    normalizeGroup,
    reconcilePhases
} from '../features/groups/groupVersions';
import { normalizeGroupDescription } from '../features/groups/groupDescription';

function uniqueMembers(members: GroupMember[]): GroupMember[] {
    return Array.from(new Map(members.map((member) => [memberKey(member), member])).values());
}

function withMembers(version: GroupVersion, members: GroupMember[]): GroupVersion {
    const nextMembers = uniqueMembers(members).map((member) => ({ ...member }));
    return {
        ...version,
        members: nextMembers,
        ...(version.phases !== undefined
            ? { phases: reconcilePhases(version.phases, nextMembers) }
            : {})
    };
}

function normalizeStoredGroup(group: Group): Group {
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

export const useGroupStore = defineStore('group', () => {
    /** Groups — part of the persisted map payload and included in undo snapshots. */
    const groups = ref<Group[]>([]);

    /** Runtime-only active version per group. Defaults are restored on load. */
    const activeVersionIds = ref<Record<string, string>>({});

    /** Runtime-only: not persisted, not part of undo snapshots. */
    const hiddenGroupIds = ref<Set<string>>(new Set());

    // ── Transient dialog state ────────────────────────────────────────────────
    const nameDialogOpen = ref(false);
    /** Non-null when the name dialog is being used for rename; null = create mode. */
    const renameGroupId = ref<string | null>(null);

    // pendingSplits contains L.Layer references — shallowRef prevents Vue Proxy wrapping.
    const pendingSplits = shallowRef<PartialPolylineSplit[]>([]);
    const splitDialogOpen = ref(false);

    /** Members to add when the next group is created (computed before opening nameDialog). */
    const pendingGroupMembers = ref<GroupMember[]>([]);
    const pendingGroupCreatedCallback = shallowRef<((groupId: string) => void) | null>(null);

    /**
     * When non-null, the area-selection flow is targeting an existing group:
     * confirming the selection adds the features to this group rather than
     * creating a new one. Drives the "Add to group" affordances in the
     * selection toolbar. Reset whenever selection is deactivated.
     */
    const addToGroupId = ref<string | null>(null);
    const pendingEmptyGroupDeletionId = ref<string | null>(null);
    const detailsGroupId = ref<string | null>(null);
    const phasesDialogOpen = ref(false);
    const phaseGroupId = ref<string | null>(null);
    const phaseVersionId = ref<string | null>(null);
    const phaseDraftActive = ref(false);
    const phaseEditingId = ref<string | null>(null);
    const pendingEmptyPhaseDeletionId = ref<string | null>(null);
    const focusedPhaseId = ref<string | null>(null);
    const playbackPlaying = ref(false);
    const playbackComplete = ref(false);
    const playbackPhaseIndex = ref<number | null>(null);

    // ── Group mutations ───────────────────────────────────────────────────────

    function setGroups(newGroups: Group[], preserveActiveVersions = false) {
        const normalizedGroups = newGroups.map(normalizeStoredGroup);
        const projectedGroups = normalizedGroups.map((group) => {
            if (!preserveActiveVersions) {
                return group;
            }
            const activeVersionId = activeVersionIds.value[group.id];
            const activeVersion = getGroupVersions(group).find(
                (version) => version.id === activeVersionId
            );
            return activeVersion ? { ...group, members: [...activeVersion.members] } : group;
        });
        groups.value = projectedGroups;
        if (
            detailsGroupId.value &&
            !projectedGroups.some((group) => group.id === detailsGroupId.value)
        ) {
            detailsGroupId.value = null;
        }
        if (phaseGroupId.value && phaseVersionId.value) {
            const phaseGroup = projectedGroups.find((group) => group.id === phaseGroupId.value);
            const phaseVersionExists = phaseGroup
                ? getGroupVersions(phaseGroup).some(
                      (version) => version.id === phaseVersionId.value
                  )
                : false;
            if (!phaseVersionExists) {
                closePhasesDialog();
            }
        }
        const nextActive: Record<string, string> = {};
        for (const group of projectedGroups) {
            const currentVersionId = activeVersionIds.value[group.id];
            nextActive[group.id] =
                preserveActiveVersions &&
                getGroupVersions(group).some((version) => version.id === currentVersionId)
                    ? currentVersionId
                    : getDefaultVersionId(group);
        }
        activeVersionIds.value = nextActive;
        if (pendingEmptyGroupDeletionId.value) {
            const pendingGroup = projectedGroups.find(
                (group) => group.id === pendingEmptyGroupDeletionId.value
            );
            if (
                !pendingGroup ||
                getActiveVersion(pendingGroup, nextActive[pendingGroup.id]).members.length > 0
            ) {
                pendingEmptyGroupDeletionId.value = null;
            }
        }
    }

    function addGroup(group: Group) {
        const normalizedGroup = normalizeStoredGroup(group);
        groups.value = [...groups.value, normalizedGroup];
        const defaultVersionId = getDefaultVersionId(normalizedGroup);
        activeVersionIds.value = {
            ...activeVersionIds.value,
            [normalizedGroup.id]: defaultVersionId
        };
    }

    function renameGroup(id: string, name: string) {
        groups.value = groups.value.map((g) => (g.id === id ? { ...g, name } : g));
    }

    function setColor(id: string, color: string) {
        groups.value = groups.value.map((group) => (group.id === id ? { ...group, color } : group));
    }

    function setDescription(id: string, description: string): boolean {
        const group = groups.value.find((item) => item.id === id);
        if (!group) {
            return false;
        }

        const nextDescription = normalizeGroupDescription(description);
        const currentDescription = normalizeGroupDescription(group.description);
        if (nextDescription === currentDescription) {
            return false;
        }

        groups.value = groups.value.map((item) =>
            item.id === id
                ? {
                      ...item,
                      ...(nextDescription
                          ? { description: nextDescription }
                          : { description: undefined })
                  }
                : item
        );
        return true;
    }

    function setMetadata(id: string, name: string, color: string, description: string): boolean {
        const group = groups.value.find((item) => item.id === id);
        if (!group || !name.trim()) {
            return false;
        }

        const nextName = name.trim();
        const nextDescription = normalizeGroupDescription(description);
        const currentDescription = normalizeGroupDescription(group.description);
        const nextColor = color || undefined;
        if (
            group.name === nextName &&
            group.color === nextColor &&
            currentDescription === nextDescription
        ) {
            return false;
        }

        groups.value = groups.value.map((item) =>
            item.id === id
                ? {
                      ...item,
                      name: nextName,
                      ...(nextColor ? { color: nextColor } : { color: undefined }),
                      ...(nextDescription
                          ? { description: nextDescription }
                          : { description: undefined })
                  }
                : item
        );
        return true;
    }

    function removeGroup(id: string) {
        groups.value = groups.value.filter((g) => g.id !== id);
        const nextActive = { ...activeVersionIds.value };
        delete nextActive[id];
        activeVersionIds.value = nextActive;
        const next = new Set(hiddenGroupIds.value);
        next.delete(id);
        hiddenGroupIds.value = next;
        if (detailsGroupId.value === id) {
            detailsGroupId.value = null;
        }
        if (phaseGroupId.value === id) {
            closePhasesDialog();
        }
    }

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
        groups.value = groups.value.map((item) =>
            item.id === groupId
                ? {
                      ...item,
                      versions: [...getGroupVersions(item), withMembers(version, version.members)],
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

    function removeVersion(groupId: string, versionId: string): GroupVersion | null {
        const group = groups.value.find((item) => item.id === groupId);
        if (!group) {
            return null;
        }
        const versions = getGroupVersions(group);
        if (versions.length <= 1 || !versions.some((version) => version.id === versionId)) {
            return null;
        }
        const remaining = versions.filter((version) => version.id !== versionId);
        const currentDefault = getDefaultVersionId(group);
        const nextDefault = currentDefault === versionId ? remaining[0].id : currentDefault;
        groups.value = groups.value.map((item) =>
            item.id === groupId
                ? {
                      ...item,
                      versions: remaining,
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

    // ── Visibility ────────────────────────────────────────────────────────────

    function toggleHidden(id: string) {
        const next = new Set(hiddenGroupIds.value);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        hiddenGroupIds.value = next;
    }

    function setAllHidden(hidden: boolean) {
        if (hidden) {
            hiddenGroupIds.value = new Set(groups.value.map((g) => g.id));
        } else {
            hiddenGroupIds.value = new Set<string>();
        }
    }

    // ── Dialog control ────────────────────────────────────────────────────────

    function openNameDialog(forRenameId: string | null = null) {
        renameGroupId.value = forRenameId;
        nameDialogOpen.value = true;
    }

    function closeNameDialog() {
        nameDialogOpen.value = false;
        renameGroupId.value = null;
    }

    function openSplitDialog(splits: PartialPolylineSplit[]) {
        pendingSplits.value = splits;
        splitDialogOpen.value = true;
    }

    /**
     * Close the split dialog but RETAIN pendingSplits so the split can be
     * performed later when the group is confirmed (deferred split).
     */
    function approveSplitDialog() {
        splitDialogOpen.value = false;
    }

    function closeSplitDialog() {
        pendingSplits.value = [];
        splitDialogOpen.value = false;
    }

    function setPendingGroupMembers(members: GroupMember[]) {
        pendingGroupMembers.value = members;
    }

    function setPendingGroupCreatedCallback(callback: ((groupId: string) => void) | null) {
        pendingGroupCreatedCallback.value = callback;
    }

    function consumePendingGroupCreatedCallback() {
        const callback = pendingGroupCreatedCallback.value;
        pendingGroupCreatedCallback.value = null;
        return callback;
    }

    function setAddToGroupId(id: string | null) {
        addToGroupId.value = id;
    }

    function setPendingEmptyGroupDeletion(id: string | null) {
        pendingEmptyGroupDeletionId.value = id;
    }

    function openDetailsDialog(id: string) {
        if (groups.value.some((group) => group.id === id)) {
            detailsGroupId.value = id;
        }
    }

    function closeDetailsDialog() {
        detailsGroupId.value = null;
    }

    function openPhasesDialog(groupId: string, versionId: string) {
        phasesDialogOpen.value = true;
        phaseGroupId.value = groupId;
        phaseVersionId.value = versionId;
        phaseDraftActive.value = true;
        phaseEditingId.value = null;
        pendingEmptyPhaseDeletionId.value = null;
        focusedPhaseId.value = null;
    }

    function setReadOnlyPhaseContext(groupId: string, versionId: string) {
        phaseGroupId.value = groupId;
        phaseVersionId.value = versionId;
        phaseDraftActive.value = false;
        phaseEditingId.value = null;
        pendingEmptyPhaseDeletionId.value = null;
        focusedPhaseId.value = null;
        playbackPlaying.value = false;
        playbackComplete.value = false;
        playbackPhaseIndex.value = null;
    }

    function closePhasesDialog() {
        phasesDialogOpen.value = false;
        phaseGroupId.value = null;
        phaseVersionId.value = null;
        phaseDraftActive.value = false;
        phaseEditingId.value = null;
        pendingEmptyPhaseDeletionId.value = null;
        focusedPhaseId.value = null;
        playbackPlaying.value = false;
        playbackComplete.value = false;
        playbackPhaseIndex.value = null;
    }

    function setFocusedPhase(id: string | null) {
        focusedPhaseId.value = id;
    }

    function clearPendingState() {
        nameDialogOpen.value = false;
        splitDialogOpen.value = false;
        pendingGroupMembers.value = [];
        pendingSplits.value = [];
        pendingGroupCreatedCallback.value = null;
        renameGroupId.value = null;
        addToGroupId.value = null;
        pendingEmptyGroupDeletionId.value = null;
        detailsGroupId.value = null;
        closePhasesDialog();
    }

    return {
        groups,
        activeVersionIds,
        hiddenGroupIds,
        nameDialogOpen,
        renameGroupId,
        pendingSplits,
        splitDialogOpen,
        pendingGroupMembers,
        pendingGroupCreatedCallback,
        addToGroupId,
        pendingEmptyGroupDeletionId,
        detailsGroupId,
        phasesDialogOpen,
        phaseGroupId,
        phaseVersionId,
        phaseDraftActive,
        phaseEditingId,
        pendingEmptyPhaseDeletionId,
        focusedPhaseId,
        playbackPlaying,
        playbackComplete,
        playbackPhaseIndex,
        setGroups,
        addGroup,
        renameGroup,
        setColor,
        setDescription,
        setMetadata,
        removeGroup,
        addMembersToGroup,
        replaceActiveVersionMembers,
        replaceVersionMember,
        removeMemberFromVersions,
        clearGroupMembers,
        getActiveGroupVersion,
        setActiveVersion,
        addVersion,
        renameVersion,
        setDefaultVersion,
        removeVersion,
        replaceVersionPhases,
        reorderVersionPhases,
        toggleHidden,
        setAllHidden,
        openNameDialog,
        closeNameDialog,
        openSplitDialog,
        approveSplitDialog,
        closeSplitDialog,
        setPendingGroupMembers,
        setPendingGroupCreatedCallback,
        consumePendingGroupCreatedCallback,
        setAddToGroupId,
        setPendingEmptyGroupDeletion,
        openDetailsDialog,
        closeDetailsDialog,
        openPhasesDialog,
        setReadOnlyPhaseContext,
        closePhasesDialog,
        setFocusedPhase,
        clearPendingState
    };
});
