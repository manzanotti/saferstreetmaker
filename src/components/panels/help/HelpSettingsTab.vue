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
            Presentation mode hides the editing tools so you can present the map without changing
            its features. Settings, sharing, help, and layer visibility controls remain available.
            Toggle it in Settings, or press <strong>P</strong> with the map focused and panels
            closed to switch it on or off. This is a viewing mode, not access control for a shared
            map.
        </p>
        <p class="mb-8">
            Finally, you can choose which layers are active on the map. Switching a layer off will
            remove the button from the toolbar and the layer from the legend. So, if you're not
            interested in adding Tram Lines or Bus Lanes to your map, you can switch either layer
            off.
        </p>
    </div>
</template>
