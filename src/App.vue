<script setup lang="ts">
import { computed } from 'vue';
import HelpPanel from './components/panels/HelpPanel.vue';
import ErrorPanel from './components/panels/ErrorPanel.vue';
import GroupNameDialog from './components/panels/GroupNameDialog.vue';
import PartialPolylineDialog from './components/panels/PartialPolylineDialog.vue';
import FeatureDeletionDialog from './components/panels/FeatureDeletionDialog.vue';
import GroupDetailsDialog from './components/panels/GroupDetailsDialog.vue';
import GroupPhasesDialog from './components/panels/GroupPhasesDialog.vue';
import ReadOnlyGroupDetailsDialog from './components/panels/ReadOnlyGroupDetailsDialog.vue';
import { useSettingsStore } from './stores/settingsStore';

const settingsStore = useSettingsStore();
const readOnly = computed(() => settingsStore.readOnly);
</script>

<template>
    <!-- Overlay panels are mounted on demand via Vue transitions. -->
    <HelpPanel />
    <ErrorPanel />
    <GroupNameDialog />
    <GroupDetailsDialog v-if="!readOnly" />
    <GroupPhasesDialog v-if="!readOnly" />
    <ReadOnlyGroupDetailsDialog v-if="readOnly" />
    <PartialPolylineDialog />
    <FeatureDeletionDialog />
</template>
