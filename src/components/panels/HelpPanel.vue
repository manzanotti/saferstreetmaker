<script setup lang="ts">
import { ref } from 'vue';
import { useUiStore } from '../../stores/uiStore';
import HelpTabWelcome from './help/HelpTabWelcome.vue';
import HelpTabFeatures from './help/HelpTabFeatures.vue';
import HelpTabGroups from './help/HelpTabGroups.vue';
import HelpTabLayers from './help/HelpTabLayers.vue';
import HelpTabMaps from './help/HelpTabMaps.vue';
import HelpTabSettings from './help/HelpTabSettings.vue';
import HelpTabSharing from './help/HelpTabSharing.vue';
import HelpTabTech from './help/HelpTabTech.vue';
import HelpTabSupport from './help/HelpTabSupport.vue';

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
                        <!-- Welcome -->
                        <div
                            id="tabs-home"
                            :class="tabPanelClass"
                            :data-tab-active="activeTab === 'tabs-home' ? '' : undefined"
                            role="tabpanel"
                            aria-labelledby="tabs-home-tab"
                        >
                            <HelpTabWelcome />
                        </div>

                        <!-- Features -->
                        <div
                            id="tabs-features"
                            :class="tabPanelClass"
                            :data-tab-active="activeTab === 'tabs-features' ? '' : undefined"
                            role="tabpanel"
                            aria-labelledby="tabs-features-tab"
                        >
                            <HelpTabFeatures />
                        </div>

                        <!-- Groups -->
                        <div
                            id="tabs-groups"
                            :class="tabPanelClass"
                            :data-tab-active="activeTab === 'tabs-groups' ? '' : undefined"
                            role="tabpanel"
                            aria-labelledby="tabs-groups-tab"
                        >
                            <HelpTabGroups />
                        </div>

                        <!-- Layers -->
                        <div
                            id="tabs-layers"
                            :class="tabPanelClass"
                            :data-tab-active="activeTab === 'tabs-layers' ? '' : undefined"
                            role="tabpanel"
                            aria-labelledby="tabs-layers-tab"
                        >
                            <HelpTabLayers />
                        </div>

                        <!-- Layers -->
                        <div
                            id="tabs-layers"
                            :class="tabPanelClass"
                            :data-tab-active="activeTab === 'tabs-layers' ? '' : undefined"
                            role="tabpanel"
                            aria-labelledby="tabs-layers-tab"
                        >
                            <h2>
                                <img
                                    src="../../img/layers-overlap.svg"
                                    class="inline-block w-10 h-10 object-contain align-middle"
                                    alt=""
                                    aria-hidden="true"
                                />
                                Layers
                            </h2>
                            <p class="mb-8">
                                The Layers panel lets you add GeoJSON data to your map as an
                                imported layer. Open it with the overlapping squares button in the
                                toolbar, or press <strong>L</strong> when the map has focus.
                            </p>
                            <h2>Adding a layer</h2>
                            <p class="mb-8">
                                Select <strong>Add layer</strong>, then upload a GeoJSON or JSON
                                file, or enter a URL to load GeoJSON from the web. Give the layer a
                                name and, if available, choose a property to use as each feature's
                                name before selecting <strong>Add layer</strong>.
                            </p>
                            <p class="mb-8">
                                Birmingham Council wards are pre-loaded as an example of the kind of
                                GeoJSON data you can import. They are hidden initially; use the eye
                                button in the Layers panel to show them.
                            </p>
                            <h2>Showing and editing layers</h2>
                            <p class="mb-8">
                                Use the eye button beside an imported layer to show or hide it. The
                                layer's features appear below the map's planning features, so they
                                do not prevent you from adding or editing other features. When a
                                feature name property was selected, click its feature to edit the
                                name in the popup.
                            </p>
                            <h2>Read-only maps</h2>
                            <p class="mb-8">
                                On a read-only map, imported layers can still be shown or hidden,
                                but they cannot be renamed or deleted, and feature names cannot be
                                edited.
                            </p>
                        </div>

                        <!-- Map Management -->
                        <div
                            id="tabs-management"
                            :class="tabPanelClass"
                            :data-tab-active="activeTab === 'tabs-management' ? '' : undefined"
                            role="tabpanel"
                            aria-labelledby="tabs-management-tab"
                        >
                            <HelpTabMaps />
                        </div>

                        <!-- Settings -->
                        <div
                            id="tabs-settings"
                            :class="tabPanelClass"
                            :data-tab-active="activeTab === 'tabs-settings' ? '' : undefined"
                            role="tabpanel"
                            aria-labelledby="tabs-settings-tab"
                        >
                            <HelpTabSettings />
                        </div>

                        <!-- Sharing Maps -->
                        <div
                            id="tabs-sharing"
                            :class="tabPanelClass"
                            :data-tab-active="activeTab === 'tabs-sharing' ? '' : undefined"
                            role="tabpanel"
                            aria-labelledby="tabs-sharing-tab"
                        >
                            <HelpTabSharing />
                        </div>

                        <!-- The Tech -->
                        <div
                            id="tabs-tech"
                            :class="tabPanelClass"
                            :data-tab-active="activeTab === 'tabs-tech' ? '' : undefined"
                            role="tabpanel"
                            aria-labelledby="tabs-tech-tab"
                        >
                            <HelpTabTech />
                        </div>

                        <!-- Support -->
                        <div
                            id="tabs-support"
                            :class="tabPanelClass"
                            :data-tab-active="activeTab === 'tabs-support' ? '' : undefined"
                            role="tabpanel"
                            aria-labelledby="tabs-support-tab"
                        >
                            <HelpTabSupport />
                        </div>
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
