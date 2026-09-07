<script setup lang="ts">
import { computed } from 'vue';
import HelpPanel from './components/panels/HelpPanel.vue';
import ErrorPanel from './components/panels/ErrorPanel.vue';
import GroupNameDialog from './components/panels/group/GroupNameDialog.vue';
import PartialPolylineDialog from './components/panels/PartialPolylineDialog.vue';
import FeatureDeletionDialog from './components/panels/FeatureDeletionDialog.vue';
import GroupDetailsDialog from './components/panels/group/GroupDetailsDialog.vue';
import GroupPhasesDialog from './components/panels/group/GroupPhasesDialog.vue';
import ReadOnlyGroupDetailsDialog from './components/panels/group/ReadOnlyGroupDetailsDialog.vue';
import PanelContainer from './components/controls/PanelContainer.vue';
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
    <PanelContainer />
</template>
