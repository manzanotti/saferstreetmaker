<script setup lang="ts">
defineProps<{
    activeTab: string;
    tabPanelClass: string;
}>();
</script>

<template>
    <div
        id="tabs-settings"
        :class="tabPanelClass"
        :data-tab-active="activeTab === 'tabs-settings' ? '' : undefined"
        role="tabpanel"
        aria-labelledby="tabs-settings-tab"
    >
        <h2>
            <img
                src="../../../img/settings-svgrepo-com.svg"
                class="inline-block w-10 h-10 object-contain align-middle"
                alt=""
                aria-hidden="true"
            />
            Settings
        </h2>
        <p class="mb-8">
            The settings window allows you to set the title of the map, see the current zoom level
            and centre point of the map.
        </p>
        <p class="mb-8">
            You can choose to make the map read-only, which will remove all the buttons for adding
            features to the map (but still shows the map management, settings, sharing, and help
            buttons).
        </p>
        <p class="mb-8">
            Finally, you can choose which layers are active on the map. Switching a layer off will
            remove the button from the toolbar and the layer from the legend. So, if you're not
            interested in adding Tram Lines or Bus Lanes to your map, you can switch either layer
            off.
        </p>
    </div>
</template>
