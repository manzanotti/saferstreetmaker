<script setup lang="ts">
import type { Group, GroupVersion } from '../../../models/Group';
import { getDefaultVersionId } from '../../../features/groups/groupVersions';

defineProps<{
    group: Group;
    version: GroupVersion;
    active: boolean;
    readOnly: boolean;
    versionsCount: number;
    memberCount: number;
    versionName: string;
    error?: string;
}>();

const emit = defineEmits<{
    'update:versionName': [name: string];
    select: [];
    saveName: [];
    openPhases: [];
    setDefault: [];
    deleteRequest: [];
}>();
</script>

<template>
    <div
        role="listitem"
        class="rounded border px-2 py-2"
        :class="active ? 'border-green-300 bg-green-50' : 'border-gray-200'"
    >
        <div class="flex items-center gap-2">
            <input
                :value="versionName"
                type="text"
                :disabled="readOnly"
                :aria-label="`Version name ${version.name}`"
                class="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                @click.stop
                @input="emit('update:versionName', ($event.target as HTMLInputElement).value)"
                @blur="emit('saveName')"
                @keydown.enter.prevent="emit('saveName')"
            />
            <button
                type="button"
                :aria-label="`Select version ${version.name}`"
                :aria-pressed="active"
                class="shrink-0 rounded border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-white"
                @click="emit('select')"
            >
                Select
            </button>
            <span class="shrink-0 text-xs text-gray-500">
                ({{ memberCount }} feature{{ memberCount === 1 ? '' : 's' }})
            </span>
            <button
                v-if="!readOnly"
                type="button"
                :aria-label="`Phases for version ${version.name}`"
                class="shrink-0 rounded border border-green-200 px-2 py-1 text-xs text-green-700 hover:bg-green-50"
                @click="emit('openPhases')"
            >
                Phases ({{ version.phases?.length ?? 0 }})
            </button>
            <button
                v-if="!readOnly"
                type="button"
                :aria-label="`Set ${version.name} as default version`"
                class="shrink-0 rounded border px-2 py-1 text-xs"
                :class="
                    getDefaultVersionId(group) === version.id
                        ? 'border-green-200 bg-green-100 text-green-700'
                        : 'border-gray-200 text-gray-600 hover:bg-white'
                "
                @click="emit('setDefault')"
            >
                {{ getDefaultVersionId(group) === version.id ? 'Default' : 'Set default' }}
            </button>
            <button
                v-if="versionsCount > 1 && !readOnly"
                type="button"
                :aria-label="`Delete version ${version.name}`"
                class="shrink-0 rounded border border-red-100 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                @click="emit('deleteRequest')"
            >
                Delete
            </button>
        </div>
        <p v-if="error" class="mt-1 text-xs text-red-600" role="alert">
            {{ error }}
        </p>
    </div>
</template>
