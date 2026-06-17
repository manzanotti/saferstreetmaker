<script setup lang="ts">
import HelpModal from './components/HelpModal.vue';
import ErrorModal from './components/ErrorModal.vue';
</script>

<template>
    <!-- HelpModal is always in the DOM so #help CSS selectors always match. -->
    <HelpModal />
    <ErrorModal />
</template>
