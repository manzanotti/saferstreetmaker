<script setup lang="ts">
import { ref } from 'vue';
import { useUiStore } from '../../stores/uiStore';

const uiStore = useUiStore();
const activeTab = ref('tabs-home');

const tabs = [
    { id: 'tabs-home', label: 'Welcome' },
    { id: 'tabs-features', label: 'Features' },
    { id: 'tabs-groups', label: 'Groups' },
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
                            <p class="mb-8">
                                Welcome to the Safer Street Maker, where you can create the active
                                travel network of your dreams!
                            </p>
                            <p class="mb-8">
                                It's very early days of the site, so don't be surprised if you
                                encounter the odd issue.
                            </p>
                            <p class="mb-8">
                                You can place various active travel features on your area. The idea
                                is to use these to instigate local conversations about improving our
                                towns and cities, or you can use these to respond to council
                                consultations on infrastructure projects (I like to respond with
                                what I think a better scheme would be).
                            </p>
                            <p class="mb-8">
                                You can now also generate html to embed your map in another web
                                page, so if you want to illustrate a blog post with an
                                infrastructure map, you now can.
                            </p>
                        </div>

                        <!-- Features -->
                        <div
                            id="tabs-features"
                            :class="tabPanelClass"
                            :data-tab-active="activeTab === 'tabs-features' ? '' : undefined"
                            role="tabpanel"
                            aria-labelledby="tabs-features-tab"
                        >
                            <h2>
                                <img
                                    src="../../img/modal-filter.svg"
                                    class="inline-block w-10 h-10 object-contain align-middle"
                                    alt=""
                                    aria-hidden="true"
                                />
                                Modal Filters
                            </h2>
                            <p class="mb-8">
                                Modal filters are designed to stop motorised vehicles from passing.
                                This is usually done with either bollards and planters, or Automatic
                                Number Plate Recognition cameras (ANPR). To add a modal filter,
                                click the Green Circle button in the toolbar on the left-hand side
                                of the map, and just click on the map to place one. Once placed, you
                                can click on one to delete it, or drag it to move it.
                            </p>
                            <h2>
                                <img
                                    src="../../img/double-decker-bus-svgrepo-com.svg"
                                    class="inline-block w-10 h-10 object-contain align-middle"
                                    alt=""
                                    aria-hidden="true"
                                />
                                Bus Gates
                            </h2>
                            <p class="mb-8">
                                Bus gates are designed to stop all motorised vehicles APART FROM
                                BUSES from passing. This is usually done with either mechanically
                                raised bollards, or Automatic Number Plate Recognition cameras
                                (ANPR). To add a bus gate, right-click or hold the Green Circle
                                button in the toolbar on the left-hand side of the map, select the
                                bus icon, and just click on the map to place one. Once placed, you
                                can click on one to delete it, or drag it to move it.
                            </p>
                            <h2>
                                <img
                                    src="../../img/bicycle-svgrepo-com.svg"
                                    class="inline-block w-10 h-10 object-contain align-middle"
                                    alt=""
                                    aria-hidden="true"
                                />
                                Mobility Lanes
                            </h2>
                            <p class="mb-8">
                                Most people think of a mobility lane as a cycle lane, and it's true
                                that the majority of traffic on them would be people on bicycles.
                                However, by designating them as Mobility lanes, this indicates that
                                they are designed to also be used by people using mobility scooters,
                                wheelchairs, and electric scooters. And to enable this requires a
                                better design of a lane (including being wide enough to allow
                                passing).
                            </p>
                            <p class="mb-8">
                                To add a mobility lane , click on the Cycle button in the toolbar.
                                You draw the lane by placing a series of points. When done, click on
                                the last point added, and you will leave lane creation mode.
                            </p>
                            <p class="mb-8">
                                To edit a lane, click anywhere on it to enter edit mode. You can
                                click on the fainter squares to add an extra point to the line, if
                                you need one. Whilst in edit mode, you will see a popup, which
                                currently has a button to delete the whole lane.
                            </p>
                            <p class="mb-8">
                                I find that the best way of placing a lane is to put the start and
                                end points of the lane whilst in create mode, click on the last
                                point you added to exit create mode, then click anywhere on the line
                                to go into edit mode. You can then place the extra points to get the
                                lane exactly where you want it.
                            </p>
                            <h2>
                                <img
                                    src="../../img/tram-svgrepo-com.svg"
                                    class="inline-block w-10 h-10 object-contain align-middle"
                                    alt=""
                                    aria-hidden="true"
                                />
                                Tram Lines
                            </h2>
                            <p class="mb-8">
                                These work in exactly the same way as mobility lanes. To add one,
                                click on the Tram button in the toolbar. You draw the lane by
                                placing a series of points. When done, click on the last point
                                added, and you will leave line creation mode.
                            </p>
                            <h2>
                                <img
                                    src="../../img/ban-on-driving-147248.svg"
                                    class="inline-block w-10 h-10 object-contain align-middle"
                                    alt=""
                                    aria-hidden="true"
                                />
                                Car-free Streets
                            </h2>
                            <p class="mb-8">
                                These are streets that are not accessible to vehicles (with possible
                                limited exceptions for deliveries). Again, these work in exactly the
                                same way as mobility lanes. To add one, click on the No Vehicles
                                button in the toolbar. You draw the lane by placing a serious of
                                points. When done, click on the last point added, and you will leave
                                line creation mode.
                            </p>
                            <h2>
                                <img
                                    src="../../img/school-street.svg"
                                    class="inline-block w-10 h-10 object-contain align-middle"
                                    alt=""
                                    aria-hidden="true"
                                />
                                School Streets
                            </h2>
                            <p class="mb-8">
                                These are streets around a school that are not accessible to
                                vehicles during drop-off and pick-up times. Again, these work in
                                exactly the same way as mobility lanes. To add one, click on the No
                                Vehicles button in the toolbar. You draw the lane by placing a
                                serious of points. When done, click on the last point added, and you
                                will leave line creation mode.
                            </p>
                            <h2>
                                <span
                                    class="inline-flex items-center justify-center w-10 h-10 text-sm font-bold align-middle"
                                    >LTN</span
                                >
                                LTNs
                            </h2>
                            <p class="mb-8">
                                LTNs, or Low Traffic Neighbourhoods/Healthy Living Zones, are
                                residential areas that restrict through-traffic, usually by placing
                                modal filters on a group of roads. They are a critical part of a
                                safe cycling network, as they provide a safe cycling environment on
                                roads that cannot have mobility lanes on them (often due to
                                on-street parking).
                            </p>
                            <p class="mb-8">
                                Cars can still get to everywhere they could previously, but may have
                                to take a slightly longer route.
                            </p>
                            <p class="mb-8">
                                You draw a polygon in much the same way as you draw a line, this
                                time clicking on the first point added to complete the shape.
                                Clicking on one allows you to set the label text for each LTN block.
                            </p>
                            <h2>
                                <img
                                    src="../../img/trafficlights-black1.svg"
                                    class="inline-block w-10 h-10 object-contain align-middle"
                                    alt=""
                                    aria-hidden="true"
                                />
                                Traffic Lights
                            </h2>
                            <p class="mb-8">
                                This feature is to define a set of traffic lights used to control
                                traffic at junctions. This usually includes phases that allow
                                pedestrians to cross the road, however if you want a set of traffic
                                lights that are purely pedestrian crossings, use the Pedestrian
                                Crossing Traffic Lights feature.
                            </p>
                            <p class="mb-8">
                                To add a traffic light, click the Traffic Light button in the
                                toolbar on the left-hand side of the map, and just click on the map
                                to place one. Once placed, you can click on one to delete it, or
                                drag it to move it.
                            </p>
                            <h2>
                                <img
                                    src="../../img/UK-Traffic-Signal-Pedestrians-1975.svg"
                                    class="inline-block w-10 h-10 object-contain align-middle"
                                    alt=""
                                    aria-hidden="true"
                                />
                                Pedestrian Crossing Traffic Lights
                            </h2>
                            <p class="mb-8">
                                This feature is to define a set of traffic lights only used to allow
                                pedestrians to cross a road.
                            </p>
                            <p class="mb-8">
                                To add a pedestrian crossing traffic light, right-click or hold the
                                Traffic Light button in the toolbar on the left-hand side of the
                                map, click on the Pedestrian Light button, and just click on the map
                                to place one. Once placed, you can click on one to delete it, or
                                drag it to move it.
                            </p>
                            <h2>
                                <img
                                    src="../../img/zebra-crossing-svgrepo-com.svg"
                                    class="inline-block w-10 h-10 object-contain align-middle"
                                    alt=""
                                    aria-hidden="true"
                                />
                                Zebra Crossings
                            </h2>
                            <p class="mb-8">
                                This feature is to define a zebra crossing, to allow pedestrians to
                                safely cross a road.
                            </p>
                            <p class="mb-8">
                                To add a zebra crossing, right-click or hold the Traffic Light
                                button in the toolbar on the left-hand side of the map, click on the
                                Zebra Crossing button, and just click on the map to place one. Once
                                placed, you can click on one to delete it, or drag it to move it.
                            </p>
                        </div>

                        <!-- Groups -->
                        <div
                            id="tabs-groups"
                            :class="tabPanelClass"
                            :data-tab-active="activeTab === 'tabs-groups' ? '' : undefined"
                            role="tabpanel"
                            aria-labelledby="tabs-groups-tab"
                        >
                            <h2>
                                <img
                                    src="../../img/group.svg"
                                    class="inline-block w-10 h-10 object-contain align-middle"
                                    alt=""
                                    aria-hidden="true"
                                />
                                Groups
                            </h2>
                            <p class="mb-8">
                                Groups let you collect related map features together. They are
                                useful for showing a complete proposal, such as a set of modal
                                filters and mobility lanes, selecting related features together, and
                                keeping alternative designs organised.
                            </p>
                            <h2>Creating and opening groups</h2>
                            <p class="mb-8">
                                To create a group, use the Area Selection tool to select one or more
                                features, then choose
                                <strong>Add selected features to a group</strong>. Give the group a
                                name when prompted. You can open the Groups panel with the Groups
                                button in the command toolbar, or press <strong>G</strong> when the
                                map has focus.
                            </p>
                            <h2>Using groups</h2>
                            <p class="mb-8">
                                Click a group name to select and highlight all of its active
                                features and fit the map to them. Use the eye button to hide or show
                                a group. The plus button lets you select additional features and add
                                them to the group. You can rename a group, remove its members
                                without deleting the map features, or delete the group and its
                                features. Group changes can be restored with Undo.
                            </p>
                            <h2>Group colours</h2>
                            <p class="mb-8">
                                Use the colour swatch beside a group to apply that colour to all LTN
                                cells in the group, including both their fill and outline. If an LTN
                                cell belongs to multiple groups with different colours, its fill and
                                outline use a striped pattern showing all of those colours.
                            </p>
                            <h2>Group versions</h2>
                            <p class="mb-8">
                                A group can contain several independent versions of a design. The
                                first version is the default. Select <strong>+ Version</strong> to
                                create a copy of the current version; its features are cloned so
                                edits to the new version do not alter the original. Give each
                                version a unique name.
                            </p>
                            <p class="mb-8">
                                Use the version dropdown to switch designs. Only the selected
                                version is shown on the map, and its features are highlighted when
                                the group is selected. Use <strong>Set default</strong> to choose
                                which version is shown when the map is loaded. The current default
                                is marked <strong>Default</strong>. Deleting a version removes its
                                copied features; Undo can restore the deletion if needed.
                            </p>
                            <h2>Group phases</h2>
                            <p class="mb-8">
                                Phases let you divide a version's features into an ordered sequence
                                of works or changes. Click <strong>Phases</strong> beside a version
                                to view its phases. Each phase contains features from that version,
                                so changing the version does not change the phase plan for another
                                version.
                            </p>
                            <p class="mb-8">
                                Click <strong>New phase</strong> to create a phase, or click an
                                existing phase to edit it. Select the features for that phase on the
                                map; features already assigned to another phase are removed from
                                that phase when they are added here. Empty phases can be deleted
                                when you finish editing.
                            </p>
                            <p class="mb-8">
                                Reorder phases by dragging them in the list. When a phase is
                                focused, you can also use the Up and Down arrow keys to move it.
                                Close the phases window when you are finished; phase changes are
                                saved with the group and can be restored with Undo.
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
                            <h2>
                                <img
                                    src="../../img/folder-svgrepo-com.svg"
                                    class="inline-block w-10 h-10 object-contain align-middle"
                                    alt=""
                                    aria-hidden="true"
                                />
                                Managing your maps
                            </h2>
                            <p class="mb-8">
                                Your maps are currently automatically saved in the browser you are
                                using every time you change the map, either the features or
                                zooming/moving the map. You can use the map management window to
                                create new maps. copy or delete maps, download map files, and open
                                files.
                            </p>
                            <p class="mb-8">
                                The window consists of a series of action buttons at the top of the
                                window, and a list of all the maps that are currently stored in this
                                browser.
                            </p>
                            <h2>
                                <img
                                    src="../../img/add-document-svgrepo-com.svg"
                                    class="inline-block w-10 h-10 object-contain align-middle"
                                    alt=""
                                    aria-hidden="true"
                                />
                                Creating a new map
                            </h2>
                            <p class="mb-8">
                                Clicking on the New Map button will bring up a text box to enter a
                                title for the new map. Enter a title and hit the Create button, and
                                a new, blank, map will be created.
                            </p>
                            <h2>
                                <img
                                    src="../../img/copy-file-svgrepo-com.svg"
                                    class="inline-block w-10 h-10 object-contain align-middle"
                                    alt=""
                                    aria-hidden="true"
                                />
                                Copying the current map
                            </h2>
                            <p class="mb-8">
                                Clicking on the Copy Map button will create a new map with the name
                                {current map name}_copy_{x}, where x is the number of copies you've
                                made of that map (so that you don't accidentally overwrite a
                                previous copy you made).
                            </p>
                            <h2>
                                <img
                                    src="../../img/folder-svgrepo-com.svg"
                                    class="inline-block w-10 h-10 object-contain align-middle"
                                    alt=""
                                    aria-hidden="true"
                                />
                                Load a map from a file
                            </h2>
                            <p class="mb-8">
                                Clicking on the Load File button to open up a file dialog to select
                                the map json file that you want to load to the map.
                            </p>
                            <h2>
                                <img
                                    src="../../img/save-svgrepo-com.svg"
                                    class="inline-block w-10 h-10 object-contain align-middle"
                                    alt=""
                                    aria-hidden="true"
                                />
                                Download the current map as a file
                            </h2>
                            <p class="mb-8">
                                Clicking on the Save file button will automatically download the map
                                JSON to your device. This will be in the form {current map
                                name}.json. You can then send this files to other devices for you to
                                work on, or to other people for them to work on, or just back-up
                                your map file.
                            </p>
                            <h2>Example map</h2>
                            <p class="mb-8">
                                If you wish to see what the file format is, there is an
                                <a href="Birmingham.json" title="Download example map" download
                                    >example map you can download</a
                                >
                                that you can look at.
                            </p>
                            <h2>
                                <img
                                    src="../../img/geojson-file-svgrepo-com.svg"
                                    class="inline-block w-10 h-10 object-contain align-middle"
                                    alt=""
                                    aria-hidden="true"
                                />
                                Download the current map as a GeoJSON file
                            </h2>
                            <p class="mb-8">
                                Clicking on the Export to GeoJSON will save the map as a GeoJson
                                file, which you can import into most GIS software programs.
                            </p>
                            <h2>Maps stored in the browser</h2>
                            <p class="mb-8">
                                All the maps that are stored in the current browser you are on will
                                be listed in this section. The current map will be in bold at the
                                top of the list, while the other maps will be listed below it. If
                                you wish to switch maps, just click on the one you want to load.
                                Your current map will be saved before swapping. You can also hit the
                                delete button to delete any of the other maps.
                            </p>
                        </div>

                        <!-- Settings -->
                        <div
                            id="tabs-settings"
                            :class="tabPanelClass"
                            :data-tab-active="activeTab === 'tabs-settings' ? '' : undefined"
                            role="tabpanel"
                            aria-labelledby="tabs-settings-tab"
                        >
                            <h2>
                                <img
                                    src="../../img/settings-svgrepo-com.svg"
                                    class="inline-block w-10 h-10 object-contain align-middle"
                                    alt=""
                                    aria-hidden="true"
                                />
                                Settings
                            </h2>
                            <p class="mb-8">
                                The settings window allows you to set the title of the map, see the
                                current zoom level and centre point of the map.
                            </p>
                            <p class="mb-8">
                                You can choose to make the map read-only, which will remove all the
                                buttons for adding features to the map (but still shows the map
                                management, settings, sharing, and help buttons).
                            </p>
                            <p class="mb-8">
                                Finally, you can choose which layers are active on the map.
                                Switching a layer off will remove the button from the toolbar and
                                the layer from the legend. So, if you're not interested in adding
                                Tram Lines to your map, you can switch that layer off.
                            </p>
                        </div>

                        <!-- Sharing Maps -->
                        <div
                            id="tabs-sharing"
                            :class="tabPanelClass"
                            :data-tab-active="activeTab === 'tabs-sharing' ? '' : undefined"
                            role="tabpanel"
                            aria-labelledby="tabs-sharing-tab"
                        >
                            <h2>Sharing maps</h2>
                            <p class="mb-8">
                                Obviously, you can save the map file and send that to someone, who
                                could upload it to the site, work on it, save it, and send it back
                                to you.
                            </p>
                            <p class="mb-8">
                                If you have somewhere you can host the json file, you can add a
                                querystring parameter to the url for this site, and it will be
                                automatically loaded. Please note that the file extension must be
                                .json, as otherwise your browser will refuse to download the file.
                            </p>
                            <p class="mb-8">
                                Furthermore, if you wish to link to different parts of the same map,
                                there are also querystring parameters to enable you to set the zoom
                                level and the centre point of the map:
                            </p>
                            <p class="mb-8">
                                https://saferstreetmaker.org?map=https://saferstreetmaker.org/Birmingham.json&amp;zoom=14&amp;centre=52.43937399964168,-1.8881893157958987
                            </p>
                            <p class="mb-8">
                                The current values for zoom and the centre point can be found in the
                                settings window. Additionally, you can add the hide-toolbar=true
                                parameter to remove the whole toolbar from the map.
                            </p>
                            <p class="mb-8">
                                You can see an example of a link
                                <a
                                    target="_blank"
                                    href="https://saferstreetmaker.org?map=https://saferstreetmaker.org/Birmingham.json&amp;zoom=14&amp;centre=52.43937399964168,-1.8881893157958987&amp;hide-toolbar=true"
                                    >here</a
                                >.
                            </p>
                            <h2>
                                <img
                                    src="../../img/share-svgrepo-com.svg"
                                    class="inline-block w-10 h-10 object-contain align-middle"
                                    alt=""
                                    aria-hidden="true"
                                />
                                Embedding a map in a web page
                            </h2>
                            <p class="mb-8">
                                However, if you wish to embed a map in a web page (such as a blog
                                post), you can create your map, open the Settings (by clicking the
                                Cog button in the toolbar), setting the map title, whether the map
                                is in read-only mode (so no one can change it), and selecting which
                                layers you want visible on the map.
                                <a href="test.html" target="_blank">Example</a>
                            </p>
                            <p class="mb-8">
                                With that done, you can click on the Share button in the toolbar.
                                Here, you can enter the dimensions of the map, and whether the
                                toolbar is visible, then hit the Create button. The html needed to
                                embed the map in your web page will be copied to your clipboard, so
                                just go to your page and paste the html into the html of your page.
                            </p>
                            <p class="mb-8">
                                If a group is selected when you create the share link, the link also
                                identifies the group and includes its active version number. Opening
                                that link shows the selected group and version in read-only mode.
                                The group panel is shown when the group has a description or the
                                selected version has implementation phases.
                            </p>
                            <p class="mb-8">Be warned: this can be a very large amount of data!</p>
                        </div>

                        <!-- The Tech -->
                        <div
                            id="tabs-tech"
                            :class="tabPanelClass"
                            :data-tab-active="activeTab === 'tabs-tech' ? '' : undefined"
                            role="tabpanel"
                            aria-labelledby="tabs-tech-tab"
                        >
                            <h2>Tech Details</h2>
                            <p class="mb-8">
                                If you're interested, this site uses the
                                <a href="https://leafletjs.com/" target="_blank">leaflet.js</a>
                                mapping library. It's built using
                                <a href="https://vitejs.dev/" target="_blank">Vite</a>. The code is
                                hosted on
                                <a
                                    href="https://github.com/manzanotti/saferstreetmaker"
                                    target="_blank"
                                    >GitHub</a
                                >. This is a public repository, so if you wish to contribute to the
                                project, feel free! The site is hosted on
                                <a href="https://www.azure.com" target="_blank">Azure</a>, as a
                                Static Web App, which is free for a ridiculous amount of traffic.
                            </p>
                        </div>

                        <!-- Support -->
                        <div
                            id="tabs-support"
                            :class="tabPanelClass"
                            :data-tab-active="activeTab === 'tabs-support' ? '' : undefined"
                            role="tabpanel"
                            aria-labelledby="tabs-support-tab"
                        >
                            <h2>Support</h2>
                            <p class="mb-8">
                                If you have a GitHub account, you can raise an
                                <a
                                    href="https://github.com/manzanotti/saferstreetmaker/issues"
                                    target="_blank"
                                    >issue</a
                                >, or you can use that to suggest a feature. You can also message me
                                on
                                <a href="https://twitter.com/manzanotti" target="_blank">Twitter</a
                                >.
                            </p>
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
