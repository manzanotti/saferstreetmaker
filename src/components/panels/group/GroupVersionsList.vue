<script setup lang="ts">
import type { Group, GroupVersion } from '../../../models/Group';

defineProps<{
    group: Group;
    versions: GroupVersion[];
    versionMemberCounts: Record<string, number>;
    activeVersionId: string | undefined;
    defaultVersionId: string | undefined;
    readOnly: boolean;
    versionNames: Record<string, string>;
    versionErrors: Record<string, string>;
    versionEditorOpen: boolean;
    versionName: string;
    versionError: string;
    pendingVersionDelete: { id: string; name: string; memberCount: number } | null;
}>();

const emit = defineEmits<{
    (e: 'update:versionNames', value: Record<string, string>): void;
    (e: 'update:versionEditorOpen', value: boolean): void;
    (e: 'update:versionName', value: string): void;
    (
        e: 'update:pendingVersionDelete',
        value: { id: string; name: string; memberCount: number } | null
    ): void;
    (e: 'create'): void;
    (e: 'select', versionId: string): void;
    (e: 'save-name', versionId: string): void;
    (e: 'set-default', versionId: string): void;
    (e: 'open-phases', versionId: string): void;
    (e: 'request-delete', versionId: string): void;
    (e: 'save-version'): void;
    (e: 'cancel-version-edit'): void;
    (e: 'confirm-delete', deleteElements: boolean): void;
}>();
</script>

<template>
    <section class="border-t border-gray-100 pt-3" aria-labelledby="group-versions-title">
        <div class="mb-2 flex items-center justify-between gap-2">
            <h3 id="group-versions-title" class="text-sm font-semibold text-gray-800">Versions</h3>
            <button
                v-if="!readOnly"
                type="button"
                class="rounded border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                aria-label="Create version"
                @click="emit('create')"
            >
                + Version
            </button>
        </div>
        <div class="space-y-2">
            <div role="list" :aria-label="`Versions for group ${group.name}`" class="space-y-1">
                <div
                    v-for="version in versions"
                    :key="version.id"
                    role="listitem"
                    class="rounded border px-2 py-2"
                    :class="
                        activeVersionId === version.id
                            ? 'border-green-300 bg-green-50'
                            : 'border-gray-200'
                    "
                >
                    <div class="flex items-center gap-2">
                        <input
                            :value="versionNames[version.id]"
                            type="text"
                            :disabled="readOnly"
                            :aria-label="`Version name ${version.name}`"
                            class="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                            @click.stop
                            @input="
                                emit('update:versionNames', {
                                    ...versionNames,
                                    [version.id]: ($event.target as HTMLInputElement).value
                                })
                            "
                            @blur="emit('save-name', version.id)"
                            @keydown.enter.prevent="emit('save-name', version.id)"
                        />
                        <button
                            type="button"
                            :aria-label="`Select version ${version.name}`"
                            :aria-pressed="activeVersionId === version.id"
                            class="shrink-0 rounded border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-white"
                            @click="emit('select', version.id)"
                        >
                            Select
                        </button>
                        <span class="shrink-0 text-xs text-gray-500">
                            ({{ versionMemberCounts[version.id] }} feature{{
                                versionMemberCounts[version.id] === 1 ? '' : 's'
                            }})
                        </span>
                        <button
                            v-if="!readOnly"
                            type="button"
                            :aria-label="`Phases for version ${version.name}`"
                            class="shrink-0 rounded border border-green-200 px-2 py-1 text-xs text-green-700 hover:bg-green-50"
                            @click="emit('open-phases', version.id)"
                        >
                            Phases ({{ version.phases?.length ?? 0 }})
                        </button>
                        <button
                            v-if="!readOnly"
                            type="button"
                            :aria-label="`Set ${version.name} as default version`"
                            class="shrink-0 rounded border px-2 py-1 text-xs"
                            :class="
                                defaultVersionId === version.id
                                    ? 'border-green-200 bg-green-100 text-green-700'
                                    : 'border-gray-200 text-gray-600 hover:bg-white'
                            "
                            @click="emit('set-default', version.id)"
                        >
                            {{ defaultVersionId === version.id ? 'Default' : 'Set default' }}
                        </button>
                        <button
                            v-if="versions.length > 1 && !readOnly"
                            type="button"
                            :aria-label="`Delete version ${version.name}`"
                            class="shrink-0 rounded border border-red-100 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                            @click="emit('request-delete', version.id)"
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
                :value="versionName"
                type="text"
                class="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                @input="emit('update:versionName', ($event.target as HTMLInputElement).value)"
                @keydown.enter.prevent="emit('save-version')"
            />
            <p v-if="versionError" class="text-xs text-red-600" role="alert">
                {{ versionError }}
            </p>
            <div class="flex justify-end gap-2">
                <button
                    type="button"
                    class="rounded border border-gray-200 px-2 py-1 text-xs text-gray-600"
                    @click="emit('cancel-version-edit')"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    class="rounded bg-green-700 px-2 py-1 text-xs font-medium text-white"
                    @click="emit('save-version')"
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
                >? Choose whether to keep its {{ pendingVersionDelete.memberCount }} element{{
                    pendingVersionDelete.memberCount === 1 ? '' : 's'
                }}.
            </p>
            <div class="flex flex-wrap gap-2">
                <button
                    type="button"
                    class="rounded border border-gray-200 bg-white px-2 py-1"
                    @click="emit('confirm-delete', false)"
                >
                    Delete version only
                </button>
                <button
                    type="button"
                    class="rounded bg-red-600 px-2 py-1 text-white"
                    @click="emit('confirm-delete', true)"
                >
                    Delete version + elements
                </button>
                <button
                    type="button"
                    class="rounded border border-gray-200 bg-white px-2 py-1"
                    @click="emit('update:pendingVersionDelete', null)"
                >
                    Cancel
                </button>
            </div>
        </div>
    </section>
</template>
