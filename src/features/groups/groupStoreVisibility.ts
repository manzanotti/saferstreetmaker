import { computed, ref, watch, type Ref } from 'vue';
import type { Group } from '../../models/Group';
import { getVisibleGroupMembers } from './groupVersions';

export function createGroupStoreVisibility(
    groups: Ref<Group[]>,
    activeVersionIds: Ref<Record<string, string>>
) {
    /** Runtime-only: not persisted, not part of undo snapshots. */
    const hiddenGroupIds = ref<Set<string>>(new Set());
    const soloGroupId = ref<string | null>(null);
    const effectiveHiddenGroupIds = computed(() =>
        soloGroupId.value
            ? new Set(
                  groups.value
                      .filter((group) => group.id !== soloGroupId.value)
                      .map((group) => group.id)
              )
            : hiddenGroupIds.value
    );

    watch(
        () => {
            if (!soloGroupId.value) {
                return true;
            }
            const group = groups.value.find((item) => item.id === soloGroupId.value);
            return (
                !!group &&
                getVisibleGroupMembers(group, activeVersionIds.value[group.id]).length > 0
            );
        },
        (valid) => {
            if (!valid) {
                setAllHidden(false);
            }
        },
        { flush: 'sync' }
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

    function cycleVisibility(id: string) {
        if (soloGroupId.value) {
            setAllHidden(false);
            return;
        }
        const group = groups.value.find((item) => item.id === id);
        if (!group) {
            return;
        }
        if (
            hiddenGroupIds.value.has(id) &&
            getVisibleGroupMembers(group, activeVersionIds.value[id]).length > 0
        ) {
            const next = new Set(hiddenGroupIds.value);
            next.delete(id);
            hiddenGroupIds.value = next;
            soloGroupId.value = id;
        } else {
            toggleHidden(id);
        }
    }

    function setAllHidden(hidden: boolean) {
        soloGroupId.value = null;
        if (hidden) {
            hiddenGroupIds.value = new Set(groups.value.map((g) => g.id));
        } else {
            hiddenGroupIds.value = new Set<string>();
        }
    }

    return {
        hiddenGroupIds,
        soloGroupId,
        effectiveHiddenGroupIds,
        toggleHidden,
        cycleVisibility,
        setAllHidden
    };
}
