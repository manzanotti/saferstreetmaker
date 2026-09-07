import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Group } from '../models/Group';
import {
    getActiveVersion,
    getDefaultVersionId,
    getGroupVersions,
    normalizeGroup
} from '../features/groups/groupVersions';
import { normalizeGroupDescription } from '../features/groups/groupDescription';
import { createGroupDialogState } from './groupDialogState';
import { createGroupVersionActions } from './groupVersionActions';
import { createGroupMemberActions } from './groupMemberActions';

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
    const dialogState = createGroupDialogState(groups);
    const {
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
        closePhasesDialog
    } = dialogState;

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

    const memberActions = createGroupMemberActions(groups, activeVersionIds);
    const versionActions = createGroupVersionActions(
        groups,
        activeVersionIds,
        closePhasesDialog,
        phaseGroupId,
        phaseVersionId
    );

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

    return {
        groups,
        activeVersionIds,
        hiddenGroupIds,
        setGroups,
        addGroup,
        renameGroup,
        setColor,
        setDescription,
        setMetadata,
        removeGroup,
        ...memberActions,
        ...versionActions,
        toggleHidden,
        setAllHidden,
        ...dialogState
    };
});
