<script setup lang="ts">
import { ref } from 'vue';
import { useUiStore } from '../../stores/uiStore';
import HelpFeaturesTab from './help/HelpFeaturesTab.vue';
import HelpGroupsTab from './help/HelpGroupsTab.vue';
import HelpLayersTab from './help/HelpLayersTab.vue';
import HelpMapsTab from './help/HelpMapsTab.vue';
import HelpSettingsTab from './help/HelpSettingsTab.vue';
import HelpSharingTab from './help/HelpSharingTab.vue';
import HelpSupportTab from './help/HelpSupportTab.vue';
import HelpTechTab from './help/HelpTechTab.vue';
import HelpWelcomeTab from './help/HelpWelcomeTab.vue';

const uiStore = useUiStore();
const activeTab = ref('tabs-home');

const tabs = [
    { id: 'tabs-home', label: 'Welcome' },
    { id: 'tabs-features', label: 'Features' },
    { id: 'tabs-groups', label: 'Groups' },
    { id: 'tabs-layers', label: 'Layers' },
    { id: 'tabs-management', label: 'Maps' },
    { id: 'tabs-settings', label: 'Settings' },
    { id: 'tabs-sharing', label: 'Sharing' },
    { id: 'tabs-tech', label: 'Tech' },
    { id: 'tabs-support', label: 'Support' }
];

const tabLinkClass =
    'my-2 block border-x-0 border-t-0 border-b-2 border-transparent px-3 pt-4 pb-3.5 text-xs font-medium uppercase leading-tight text-neutral-500 hover:isolate hover:border-transparent hover:bg-neutral-100 focus:isolate focus:border-transparent data-[tab-nav-active]:border-primary data-[tab-nav-active]:text-primary dark:text-neutral-400 dark:hover:bg-transparent dark:data-[tab-nav-active]:border-primary-400 dark:data-[tab-nav-active]:text-primary-400';
const tabPanelClass =
    'hidden opacity-0 transition-opacity duration-150 ease-linear data-[tab-active]:block data-[tab-active]:opacity-100';

function selectTab(tabId: string) {
    activeTab.value = tabId;
}

function close() {
    uiStore.closePanel();
}
</script>

<template>
    <Transition name="overlay-fade">
        <div
            v-if="uiStore.activePanel === 'help'"
            id="help"
            class="fixed inset-0 z-[10002] flex items-center justify-center pointer-events-none"
            @keydown.escape.window="close"
            @dblclick.stop
        >
            <div
                role="dialog"
                aria-labelledby="help-panel-title"
                class="pointer-events-auto relative rounded-2xl bg-white shadow-xl border border-gray-100 w-[min(90vw,720px)] max-h-[90vh] flex flex-col overflow-hidden"
            >
                <div
                    class="flex shrink-0 items-center justify-between px-5 py-4 border-b border-gray-100"
                >
                    <h2 id="help-panel-title" class="text-base font-semibold text-gray-800">
                        Using Safer Street Maker
                    </h2>
                </div>

                <div class="flex-1 overflow-y-auto px-5 py-4">
                    <!-- Tab navigation -->
                    <ul
                        class="mb-5 flex list-none flex-col flex-wrap border-b-0 pl-0 md:flex-row"
                        role="tablist"
                        data-tab-nav
                    >
                        <li v-for="tab in tabs" :key="tab.id" role="presentation">
                            <a
                                :id="`${tab.id}-tab`"
                                :href="`#${tab.id}`"
                                :class="tabLinkClass"
                                :data-tab-nav-active="activeTab === tab.id ? '' : undefined"
                                data-tab-toggle
                                :data-tab-target="`#${tab.id}`"
                                role="tab"
                                :aria-controls="tab.id"
                                :aria-selected="activeTab === tab.id"
                                @click.prevent="selectTab(tab.id)"
                                >{{ tab.label }}</a
                            >
                        </li>
                    </ul>

                    <div class="mb-6">
                        <HelpWelcomeTab :active-tab="activeTab" :tab-panel-class="tabPanelClass" />
                        <HelpFeaturesTab :active-tab="activeTab" :tab-panel-class="tabPanelClass" />
                        <HelpGroupsTab :active-tab="activeTab" :tab-panel-class="tabPanelClass" />
                        <HelpLayersTab :active-tab="activeTab" :tab-panel-class="tabPanelClass" />
                        <HelpMapsTab :active-tab="activeTab" :tab-panel-class="tabPanelClass" />
                        <HelpSettingsTab :active-tab="activeTab" :tab-panel-class="tabPanelClass" />
                        <HelpSharingTab :active-tab="activeTab" :tab-panel-class="tabPanelClass" />
                        <HelpTechTab :active-tab="activeTab" :tab-panel-class="tabPanelClass" />
                        <HelpSupportTab :active-tab="activeTab" :tab-panel-class="tabPanelClass" />
                    </div>
                </div>

                <div
                    class="flex shrink-0 items-center justify-end px-5 py-4 border-t border-gray-100"
                >
                    <button
                        type="button"
                        name="closeHelp"
                        class="rounded-lg bg-slate-50 hover:bg-slate-100 border border-gray-200 text-gray-700 px-4 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-1 focus-visible:outline-none [touch-action:manipulation]"
                        @click="close"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    </Transition>
</template>
