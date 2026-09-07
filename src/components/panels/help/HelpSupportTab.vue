<script setup lang="ts">
defineProps<{
    activeTab: string;
    tabPanelClass: string;
}>();
</script>

<template>
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
            <a href="https://github.com/manzanotti/saferstreetmaker/issues" target="_blank">issue</a
            >, or you can use that to suggest a feature. You can also message me on
            <a href="https://twitter.com/manzanotti" target="_blank">Twitter</a>.
        </p>
    </div>
</template>
