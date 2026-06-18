<script setup lang="ts">
import HelpModal from './components/modals/HelpModal.vue';
import ErrorModal from './components/modals/ErrorModal.vue';
</script>

<template>
    <!-- Overlay modals are mounted on demand via Vue transitions. -->
    <HelpModal />
    <ErrorModal />
</template>
