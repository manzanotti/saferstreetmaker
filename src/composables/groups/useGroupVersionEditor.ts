import { computed, ref, watch, type ComputedRef } from 'vue';
import type { Group } from '../../models/Group';
import {
    createGroupVersion,
    deleteGroupVersion,
    openGroupPhases,
    renameGroupVersion,
    setGroupDefaultVersion,
    switchGroupVersion
} from '../useGroups';
import { getGroupVersions, memberKey } from '../../features/groups/groupVersions';

interface UseGroupVersionEditorOptions {
    group: ComputedRef<Group | undefined>;
    versions: ComputedRef<ReturnType<typeof getGroupVersions>>;
    persistDetails: () => void;
}

export function useGroupVersionEditor(options: UseGroupVersionEditorOptions) {
    const versionName = ref('');
    const versionError = ref('');
    const versionNames = ref<Record<string, string>>({});
    const versionErrors = ref<Record<string, string>>({});
    const versionEditorOpen = ref(false);
    const pendingVersionDelete = ref<{ id: string; name: string; memberCount: number } | null>(
        null
    );
    const versionMemberCounts = computed<Record<string, number>>(() =>
        Object.fromEntries(
            options.versions.value.map((version) => [
                version.id,
                new Set(version.members.map(memberKey)).size
            ])
        )
    );

    watch(options.versions, (nextVersions) => syncVersionNames(nextVersions), {
        deep: true,
        immediate: true
    });

    function syncVersionNames(nextVersions: ReturnType<typeof getGroupVersions>) {
        const nextNames: Record<string, string> = {};
        nextVersions.forEach((version) => {
            nextNames[version.id] = versionNames.value[version.id] ?? version.name;
        });
        versionNames.value = nextNames;
        versionErrors.value = Object.fromEntries(
            Object.entries(versionErrors.value).filter(([id]) => id in nextNames)
        );
    }

    function startCreateVersion() {
        versionEditorOpen.value = true;
        versionName.value = '';
        versionError.value = '';
    }

    function cancelVersionEdit() {
        versionEditorOpen.value = false;
        versionName.value = '';
        versionError.value = '';
    }

    function selectVersion(versionId: string) {
        if (!options.group.value) {
            return;
        }
        options.persistDetails();
        switchGroupVersion(options.group.value.id, versionId);
    }

    function saveVersion() {
        if (!options.group.value || !versionName.value.trim()) {
            return;
        }
        const updated = createGroupVersion(options.group.value.id, versionName.value);
        if (!updated) {
            versionError.value = 'Enter a unique version name.';
            return;
        }
        cancelVersionEdit();
    }

    function saveVersionName(versionId: string) {
        if (!options.group.value) {
            return;
        }
        const nextName = versionNames.value[versionId]?.trim() ?? '';
        const version = options.versions.value.find((item) => item.id === versionId);
        if (!version || !nextName) {
            if (version) {
                versionNames.value[versionId] = version.name;
            }
            versionErrors.value[versionId] = 'Enter a version name.';
            return;
        }
        if (nextName === version.name) {
            versionNames.value[versionId] = version.name;
            delete versionErrors.value[versionId];
            return;
        }
        if (!renameGroupVersion(options.group.value.id, versionId, nextName)) {
            versionErrors.value[versionId] = 'Enter a unique version name.';
            return;
        }
        versionNames.value[versionId] = nextName;
        delete versionErrors.value[versionId];
    }

    function setDefault(versionId: string) {
        if (options.group.value) {
            setGroupDefaultVersion(options.group.value.id, versionId);
        }
    }

    function openPhases(versionId: string) {
        if (options.group.value) {
            options.persistDetails();
            openGroupPhases(options.group.value.id, versionId);
        }
    }

    function requestDeleteVersion(versionId: string) {
        if (!options.group.value || options.versions.value.length <= 1) {
            return;
        }
        const version = options.versions.value.find((item) => item.id === versionId);
        if (!version) {
            return;
        }
        const count = new Set(version.members.map(memberKey)).size;
        if (count === 0) {
            deleteGroupVersion(options.group.value.id, version.id);
            return;
        }
        pendingVersionDelete.value = { id: version.id, name: version.name, memberCount: count };
    }

    function confirmDeleteVersion(deleteElements: boolean) {
        if (options.group.value && pendingVersionDelete.value) {
            deleteGroupVersion(
                options.group.value.id,
                pendingVersionDelete.value.id,
                deleteElements
            );
        }
        pendingVersionDelete.value = null;
    }

    function updateVersionName(versionId: string, nextName: string) {
        versionNames.value[versionId] = nextName;
    }

    return {
        versionName,
        versionError,
        versionNames,
        versionErrors,
        versionEditorOpen,
        pendingVersionDelete,
        versionMemberCounts,
        cancelVersionEdit,
        confirmDeleteVersion,
        openPhases,
        requestDeleteVersion,
        saveVersion,
        saveVersionName,
        selectVersion,
        setDefault,
        startCreateVersion,
        syncVersionNames,
        updateVersionName
    };
}
