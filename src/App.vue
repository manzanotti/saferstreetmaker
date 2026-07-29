<script setup lang="ts">
import HelpPanel from './components/panels/HelpPanel.vue';
import ErrorPanel from './components/panels/ErrorPanel.vue';
import GroupNameDialog from './components/panels/GroupNameDialog.vue';
import PartialPolylineDialog from './components/panels/PartialPolylineDialog.vue';
import FeatureDeletionDialog from './components/panels/FeatureDeletionDialog.vue';
import GroupDetailsDialog from './components/panels/GroupDetailsDialog.vue';
</script>

<template>
    <!-- Overlay panels are mounted on demand via Vue transitions. -->
    <HelpPanel />
    <ErrorPanel />
    <GroupNameDialog />
    <GroupDetailsDialog />
    <PartialPolylineDialog />
    <FeatureDeletionDialog />
</template>
