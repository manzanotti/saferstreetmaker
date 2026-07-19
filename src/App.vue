<script setup lang="ts">
import HelpPanel from './components/panels/HelpPanel.vue';
import ErrorPanel from './components/panels/ErrorPanel.vue';
</script>

<template>
    <!-- Overlay panels are mounted on demand via Vue transitions. -->
    <HelpPanel />
    <ErrorPanel />
</template>
