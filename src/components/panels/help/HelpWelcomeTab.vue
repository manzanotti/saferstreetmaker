<script setup lang="ts">
defineProps<{
    activeTab: string;
    tabPanelClass: string;
}>();
</script>

<template>
    <div
        id="tabs-home"
        :class="tabPanelClass"
        :data-tab-active="activeTab === 'tabs-home' ? '' : undefined"
        role="tabpanel"
        aria-labelledby="tabs-home-tab"
    >
        <p class="mb-8">
            Welcome to the Safer Street Maker, where you can create the active travel network of
            your dreams!
        </p>
        <p class="mb-8">
            It's very early days of the site, so don't be surprised if you encounter the odd issue.
        </p>
        <p class="mb-8">
            You can place various active travel features on your area. The idea is to use these to
            instigate local conversations about improving our towns and cities, or you can use these
            to respond to council consultations on infrastructure projects (I like to respond with
            what I think a better scheme would be).
        </p>
        <p class="mb-8">
            You can now also generate html to embed your map in another web page, so if you want to
            illustrate a blog post with an infrastructure map, you now can.
        </p>
    </div>
</template>
