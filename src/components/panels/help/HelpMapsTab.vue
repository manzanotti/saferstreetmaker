<script setup lang="ts">
defineProps<{
    activeTab: string;
    tabPanelClass: string;
}>();
</script>

<template>
    <div
        id="tabs-management"
        :class="tabPanelClass"
        :data-tab-active="activeTab === 'tabs-management' ? '' : undefined"
        role="tabpanel"
        aria-labelledby="tabs-management-tab"
    >
        <h2>
            <img
                src="../../../img/folder-svgrepo-com.svg"
                class="inline-block w-10 h-10 object-contain align-middle"
                alt=""
                aria-hidden="true"
            />
            Managing your maps
        </h2>
        <p class="mb-8">
            Your maps are currently automatically saved in the browser you are using every time you
            change the map, either the features or zooming/moving the map. You can use the map
            management window to create new maps, copy or delete maps, download map files, and open
            files.
        </p>
        <p class="mb-8">
            The window consists of a series of action buttons at the top of the window, and a list
            of all the maps that are currently stored in this browser.
        </p>
        <h2>
            <img
                src="../../../img/add-document-svgrepo-com.svg"
                class="inline-block w-10 h-10 object-contain align-middle"
                alt=""
                aria-hidden="true"
            />
            Creating a new map
        </h2>
        <p class="mb-8">
            Clicking on the New Map button will bring up a text box to enter a title for the new
            map. Enter a title and hit the Create button, and a new, blank, map will be created.
        </p>
        <h2>
            <img
                src="../../../img/copy-file-svgrepo-com.svg"
                class="inline-block w-10 h-10 object-contain align-middle"
                alt=""
                aria-hidden="true"
            />
            Copying the current map
        </h2>
        <p class="mb-8">
            Clicking on the Copy Map button will create a new map with the name {current map
            name}_copy_{x}, where x is the number of copies you've made of that map (so that you
            don't accidentally overwrite a previous copy you made).
        </p>
        <h2>
            <img
                src="../../../img/folder-svgrepo-com.svg"
                class="inline-block w-10 h-10 object-contain align-middle"
                alt=""
                aria-hidden="true"
            />
            Load a map from a file
        </h2>
        <p class="mb-8">
            Clicking on the Load File button to open up a file dialog to select the map json file
            that you want to load to the map.
        </p>
        <h2>
            <img
                src="../../../img/save-svgrepo-com.svg"
                class="inline-block w-10 h-10 object-contain align-middle"
                alt=""
                aria-hidden="true"
            />
            Download the current map as a file
        </h2>
        <p class="mb-8">
            Clicking on the Save file button will automatically download the map JSON to your
            device. This will be in the form {current map name}.json. You can then send this files
            to other devices for you to work on, or to other people for them to work on, or just
            back-up your map file.
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
                src="../../../img/geojson-file-svgrepo-com.svg"
                class="inline-block w-10 h-10 object-contain align-middle"
                alt=""
                aria-hidden="true"
            />
            Download the current map as a GeoJSON file
        </h2>
        <p class="mb-8">
            Clicking on the Export to GeoJSON will save the map as a GeoJSON file, which you can
            import into most GIS software programs.
        </p>
        <h2>Maps stored in the browser</h2>
        <p class="mb-8">
            All the maps that are stored in the current browser you are on will be listed in this
            section. The current map will be in bold at the top of the list, while the other maps
            will be listed below it. If you wish to switch maps, just click on the one you want to
            load. Your current map will be saved before swapping. You can also hit the delete button
            to delete any of the other maps.
        </p>
    </div>
</template>
