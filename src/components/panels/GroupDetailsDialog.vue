<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useGroupStore } from '../../stores/groupStore';
import { useUiStore } from '../../stores/uiStore';
import {
    applyGroupDetails,
    beginAddToGroup,
    createGroupVersion,
    deleteGroup,
    deleteGroupVersion,
    deleteGroupWithElements,
    openGroupPhases,
    removeAllGroupElements,
    renameGroupVersion,
    setGroupDefaultVersion,
    switchGroupVersion
} from '../../composables/useGroups';
import {
    getDefaultVersionId,
    getGroupVersions,
    memberKey
} from '../../features/groups/groupVersions';
import {
    GROUP_DESCRIPTION_MAX_LENGTH,
    sanitizeGroupDescription
} from '../../features/groups/groupDescription';
import { DEFAULT_GROUP_COLOUR } from '../../features/groups/groupColours';

const groupStore = useGroupStore();
const uiStore = useUiStore();
const group = computed(() =>
    groupStore.groups.find((item) => item.id === groupStore.detailsGroupId)
);
const versions = computed(() => (group.value ? getGroupVersions(group.value) : []));
const versionMemberCounts = computed<Record<string, number>>(() =>
    Object.fromEntries(
        versions.value.map((version) => [version.id, new Set(version.members.map(memberKey)).size])
    )
);

const name = ref('');
const color = ref(DEFAULT_GROUP_COLOUR);
const description = ref('');
const versionName = ref('');
const versionError = ref('');
const versionNames = ref<Record<string, string>>({});
const versionErrors = ref<Record<string, string>>({});
const versionEditorOpen = ref(false);
const pendingVersionDelete = ref<{ id: string; name: string; memberCount: number } | null>(null);
const pendingGroupDelete = ref(false);
const nameInput = ref<HTMLInputElement | null>(null);

const isOpen = computed(() => groupStore.detailsGroupId !== null && Boolean(group.value));
const pendingEmptyGroupDeletion = computed(() =>
    Boolean(group.value && groupStore.pendingEmptyGroupDeletionId === group.value.id)
);
const renderedDescription = computed(() => sanitizeGroupDescription(description.value));

watch(
    () => uiStore.activePanel,
    (activePanel) => {
        if (activePanel === 'groups') {
            groupStore.closeDetailsDialog();
        }
    }
);

watch(
    () => groupStore.detailsGroupId,
    (id) => {
        const nextGroup = groupStore.groups.find((item) => item.id === id);
        if (!nextGroup) {
            resetDraft();
            return;
        }
        name.value = nextGroup.name;
        color.value = nextGroup.color ?? DEFAULT_GROUP_COLOUR;
        description.value = nextGroup.description ?? '';
        cancelVersionEdit();
        syncVersionNames(getGroupVersions(nextGroup));
        pendingVersionDelete.value = null;
        pendingGroupDelete.value = false;
        void nextTick(() => nameInput.value?.focus());
    },
    { immediate: true }
);

watch(versions, (nextVersions) => syncVersionNames(nextVersions), { deep: true, immediate: true });

function resetDraft() {
    name.value = '';
    color.value = DEFAULT_GROUP_COLOUR;
    description.value = '';
    cancelVersionEdit();
    pendingVersionDelete.value = null;
    pendingGroupDelete.value = false;
}

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

function close() {
    groupStore.setPendingEmptyGroupDeletion(null);
    groupStore.closeDetailsDialog();
}

function onSave() {
    if (!group.value || !name.value.trim()) {
        return;
    }
    applyGroupDetails(group.value.id, name.value, color.value, description.value);
    close();
}

function onCancel() {
    close();
}

function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
        close();
    }
}

function onAddFeatures() {
    if (!group.value) {
        return;
    }
    beginAddToGroup(group.value.id);
    close();
}

function onRemoveMembers() {
    if (!group.value) {
        return;
    }
    removeAllGroupElements(group.value.id);
    groupStore.setPendingEmptyGroupDeletion(group.value.id);
}

function confirmEmptyGroup(deleteIt: boolean) {
    if (deleteIt && group.value) {
        deleteGroup(group.value.id);
        close();
    }
    groupStore.setPendingEmptyGroupDeletion(null);
}

function selectVersion(versionId: string) {
    if (!group.value) {
        return;
    }
    switchGroupVersion(group.value.id, versionId);
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

function saveVersion() {
    if (!group.value || !versionName.value.trim()) {
        return;
    }
    const updated = createGroupVersion(group.value.id, versionName.value);
    if (!updated) {
        versionError.value = 'Enter a unique version name.';
        return;
    }
    cancelVersionEdit();
}

function saveVersionName(versionId: string) {
    if (!group.value) {
        return;
    }
    const nextName = versionNames.value[versionId]?.trim() ?? '';
    const version = versions.value.find((item) => item.id === versionId);
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
    if (!renameGroupVersion(group.value.id, versionId, nextName)) {
        versionErrors.value[versionId] = 'Enter a unique version name.';
        return;
    }
    versionNames.value[versionId] = nextName;
    delete versionErrors.value[versionId];
}

function setDefault(versionId: string) {
    if (group.value) {
        setGroupDefaultVersion(group.value.id, versionId);
    }
}

function openPhases(versionId: string) {
    if (group.value) {
        openGroupPhases(group.value.id, versionId);
    }
}

function requestDeleteVersion(versionId: string) {
    if (!group.value || versions.value.length <= 1) {
        return;
    }
    const version = versions.value.find((item) => item.id === versionId);
    if (!version) {
        return;
    }
    const count = new Set(version.members.map(memberKey)).size;
    if (count === 0) {
        deleteGroupVersion(group.value.id, version.id);
        return;
    }
    pendingVersionDelete.value = { id: version.id, name: version.name, memberCount: count };
}

function confirmDeleteVersion(deleteElements: boolean) {
    if (group.value && pendingVersionDelete.value) {
        deleteGroupVersion(group.value.id, pendingVersionDelete.value.id, deleteElements);
    }
    pendingVersionDelete.value = null;
}

function requestDeleteGroup() {
    pendingGroupDelete.value = true;
}

function confirmDeleteGroup(deleteElements: boolean) {
    if (group.value) {
        if (deleteElements) {
            deleteGroupWithElements(group.value.id);
        } else {
            deleteGroup(group.value.id);
        }
    }
    pendingGroupDelete.value = false;
    close();
}
</script>

<template>
    <div
        v-if="isOpen && group"
        role="dialog"
        aria-modal="true"
        aria-labelledby="group-details-dialog-title"
        class="fixed top-1/2 left-1/2 z-[9999] flex max-h-[90vh] w-[min(42rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl"
        @dblclick.stop
        @keydown="onKeydown"
    >
        <div class="flex items-center justify-between border-b border-gray-100 px-5 py-3">
            <h2 id="group-details-dialog-title" class="text-base font-semibold text-gray-800">
                Group details
            </h2>
            <button
                type="button"
                aria-label="Close group details"
                class="rounded text-gray-400 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
                @click="close"
            >
                <span aria-hidden="true" class="text-xl leading-none">&times;</span>
            </button>
        </div>

        <div class="space-y-3 overflow-y-auto px-5 py-3">
            <div class="grid gap-3 sm:grid-cols-[1fr_auto]">
                <div>
                    <label
                        for="group-details-name"
                        class="mb-1 block text-sm font-medium text-gray-700"
                    >
                        Group name
                    </label>
                    <input
                        id="group-details-name"
                        ref="nameInput"
                        v-model="name"
                        type="text"
                        class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                </div>
                <div>
                    <label
                        for="group-details-colour"
                        class="mb-1 block text-sm font-medium text-gray-700"
                    >
                        Colour
                    </label>
                    <input
                        id="group-details-colour"
                        v-model="color"
                        type="color"
                        class="group-colour-swatch h-10 w-14 cursor-pointer rounded border border-gray-200 p-1"
                        aria-label="Choose group colour"
                    />
                </div>
            </div>

            <div>
                <div class="mb-1 flex items-center justify-between gap-2">
                    <label
                        for="group-details-description"
                        class="block text-sm font-medium text-gray-700"
                    >
                        Description
                    </label>
                    <span class="text-xs text-gray-500">
                        {{ description.length }}/{{ GROUP_DESCRIPTION_MAX_LENGTH }} characters
                    </span>
                </div>
                <textarea
                    id="group-details-description"
                    v-model="description"
                    :maxlength="GROUP_DESCRIPTION_MAX_LENGTH"
                    rows="4"
                    placeholder="Optional description"
                    class="w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                ></textarea>
                <div
                    v-if="renderedDescription"
                    class="group-description-content mt-2 rounded border border-gray-100 bg-slate-50 px-3 py-2 text-xs leading-relaxed text-gray-600"
                    v-html="renderedDescription"
                ></div>
            </div>

            <section class="border-t border-gray-100 pt-3" aria-labelledby="group-versions-title">
                <div class="mb-2 flex items-center justify-between gap-2">
                    <h3 id="group-versions-title" class="text-sm font-semibold text-gray-800">
                        Versions
                    </h3>
                    <button
                        type="button"
                        class="rounded border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                        aria-label="Create version"
                        @click="startCreateVersion"
                    >
                        + Version
                    </button>
                </div>
                <div class="space-y-2">
                    <div
                        role="list"
                        :aria-label="`Versions for group ${group.name}`"
                        class="space-y-1"
                    >
                        <div
                            v-for="version in versions"
                            :key="version.id"
                            role="listitem"
                            class="rounded border px-2 py-2"
                            :class="
                                groupStore.activeVersionIds[group.id] === version.id
                                    ? 'border-green-300 bg-green-50'
                                    : 'border-gray-200'
                            "
                        >
                            <div class="flex items-center gap-2">
                                <input
                                    v-model="versionNames[version.id]"
                                    type="text"
                                    :aria-label="`Version name ${version.name}`"
                                    class="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                                    @click.stop
                                    @blur="saveVersionName(version.id)"
                                    @keydown.enter.prevent="saveVersionName(version.id)"
                                />
                                <button
                                    type="button"
                                    :aria-label="`Select version ${version.name}`"
                                    :aria-pressed="
                                        groupStore.activeVersionIds[group.id] === version.id
                                    "
                                    class="shrink-0 rounded border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-white"
                                    @click="selectVersion(version.id)"
                                >
                                    Select
                                </button>
                                <span class="shrink-0 text-xs text-gray-500">
                                    ({{ versionMemberCounts[version.id] }} feature{{
                                        versionMemberCounts[version.id] === 1 ? '' : 's'
                                    }})
                                </span>
                                <button
                                    type="button"
                                    :aria-label="`Phases for version ${version.name}`"
                                    class="shrink-0 rounded border border-green-200 px-2 py-1 text-xs text-green-700 hover:bg-green-50"
                                    @click="openPhases(version.id)"
                                >
                                    Phases
                                </button>
                                <button
                                    type="button"
                                    :aria-label="`Set ${version.name} as default version`"
                                    class="shrink-0 rounded border px-2 py-1 text-xs"
                                    :class="
                                        getDefaultVersionId(group) === version.id
                                            ? 'border-green-200 bg-green-100 text-green-700'
                                            : 'border-gray-200 text-gray-600 hover:bg-white'
                                    "
                                    @click="setDefault(version.id)"
                                >
                                    {{
                                        getDefaultVersionId(group) === version.id
                                            ? 'Default'
                                            : 'Set default'
                                    }}
                                </button>
                                <button
                                    v-if="versions.length > 1"
                                    type="button"
                                    :aria-label="`Delete version ${version.name}`"
                                    class="shrink-0 rounded border border-red-100 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                                    @click="requestDeleteVersion(version.id)"
                                >
                                    Delete
                                </button>
                            </div>
                            <p
                                v-if="versionErrors[version.id]"
                                class="mt-1 text-xs text-red-600"
                                role="alert"
                            >
                                {{ versionErrors[version.id] }}
                            </p>
                        </div>
                    </div>
                </div>
                <div
                    v-if="versionEditorOpen"
                    class="mt-3 space-y-2 rounded border border-gray-100 bg-slate-50 p-3"
                >
                    <label for="group-version-name" class="block text-xs font-medium text-gray-700">
                        New version
                    </label>
                    <input
                        id="group-version-name"
                        v-model="versionName"
                        type="text"
                        class="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        @keydown.enter.prevent="saveVersion"
                    />
                    <p v-if="versionError" class="text-xs text-red-600" role="alert">
                        {{ versionError }}
                    </p>
                    <div class="flex justify-end gap-2">
                        <button
                            type="button"
                            class="rounded border border-gray-200 px-2 py-1 text-xs text-gray-600"
                            @click="cancelVersionEdit"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            class="rounded bg-green-700 px-2 py-1 text-xs font-medium text-white"
                            @click="saveVersion"
                        >
                            Save
                        </button>
                    </div>
                </div>
                <div
                    v-if="pendingVersionDelete"
                    class="mt-3 space-y-2 rounded border border-red-100 bg-red-50 p-3 text-xs text-gray-700"
                >
                    <p>
                        Delete version <strong>{{ pendingVersionDelete.name }}</strong
                        >? Choose whether to keep its
                        {{ pendingVersionDelete.memberCount }} element{{
                            pendingVersionDelete.memberCount === 1 ? '' : 's'
                        }}.
                    </p>
                    <div class="flex flex-wrap gap-2">
                        <button
                            type="button"
                            class="rounded border border-gray-200 bg-white px-2 py-1"
                            @click="confirmDeleteVersion(false)"
                        >
                            Delete version only
                        </button>
                        <button
                            type="button"
                            class="rounded bg-red-600 px-2 py-1 text-white"
                            @click="confirmDeleteVersion(true)"
                        >
                            Delete version + elements
                        </button>
                        <button
                            type="button"
                            class="rounded border border-gray-200 bg-white px-2 py-1"
                            @click="pendingVersionDelete = null"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </section>

            <section class="border-t border-gray-100 pt-3" aria-labelledby="group-features-title">
                <h3 id="group-features-title" class="mb-2 text-sm font-semibold text-gray-800">
                    Features
                </h3>
                <div
                    v-if="pendingEmptyGroupDeletion"
                    class="mb-3 space-y-2 rounded border border-red-100 bg-red-50 p-3 text-xs text-gray-700"
                >
                    <p>
                        <strong>{{ group.name }}</strong> is now empty. Delete the group too?
                    </p>
                    <div class="flex gap-2">
                        <button
                            type="button"
                            class="rounded bg-red-600 px-2 py-1 text-white"
                            @click="confirmEmptyGroup(true)"
                        >
                            Delete
                        </button>
                        <button
                            type="button"
                            class="rounded border border-gray-200 bg-white px-2 py-1"
                            @click="confirmEmptyGroup(false)"
                        >
                            Keep empty
                        </button>
                    </div>
                </div>
                <div class="flex flex-wrap gap-2">
                    <button
                        type="button"
                        class="rounded bg-green-700 px-3 py-2 text-xs font-medium text-white hover:bg-green-800"
                        :aria-label="`Add features to group ${group.name}`"
                        @click="onAddFeatures"
                    >
                        Add features
                    </button>
                    <button
                        type="button"
                        class="rounded border border-gray-200 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
                        :aria-label="`Remove all elements from group ${group.name}`"
                        @click="onRemoveMembers"
                    >
                        Remove all
                    </button>
                </div>
            </section>

            <section v-if="pendingGroupDelete" class="border-t border-red-100 pt-3">
                <div
                    class="space-y-2 rounded border border-red-100 bg-red-50 p-3 text-xs text-gray-700"
                >
                    <p>
                        Delete <strong>{{ group.name }}</strong
                        >? Choose whether to keep its elements.
                    </p>
                    <div class="flex flex-wrap gap-2">
                        <button
                            type="button"
                            class="rounded border border-gray-200 bg-white px-2 py-1"
                            @click="confirmDeleteGroup(false)"
                        >
                            Delete group only
                        </button>
                        <button
                            type="button"
                            class="rounded bg-red-600 px-2 py-1 text-white"
                            @click="confirmDeleteGroup(true)"
                        >
                            Delete group + elements
                        </button>
                        <button
                            type="button"
                            class="rounded border border-gray-200 bg-white px-2 py-1"
                            @click="pendingGroupDelete = false"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </section>
        </div>

        <div class="flex items-center gap-2 border-t border-gray-100 px-5 py-3">
            <button
                v-if="!pendingGroupDelete"
                type="button"
                class="mr-auto rounded border border-red-200 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50"
                :aria-label="`Delete group ${group.name}`"
                @click="requestDeleteGroup"
            >
                Delete group
            </button>
            <button
                type="button"
                class="rounded-lg border border-gray-200 bg-slate-50 px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-slate-100"
                @click="onCancel"
            >
                Cancel
            </button>
            <button
                type="button"
                :disabled="!name.trim()"
                class="rounded-lg bg-green-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-40"
                @click="onSave"
            >
                Save
            </button>
        </div>
    </div>
</template>

<style scoped>
.group-description-content :deep(p),
.group-description-content :deep(h3),
.group-description-content :deep(h4),
.group-description-content :deep(blockquote),
.group-description-content :deep(pre),
.group-description-content :deep(ul),
.group-description-content :deep(ol) {
    margin: 0.35rem 0;
}

.group-description-content :deep(ul),
.group-description-content :deep(ol) {
    padding-left: 1.25rem;
}

.group-description-content :deep(ul) {
    list-style: disc;
}

.group-description-content :deep(ol) {
    list-style: decimal;
}

.group-description-content :deep(a) {
    color: #047857;
    text-decoration: underline;
}
</style>
