<script setup lang="ts">
const props = defineProps<{
    icon?: keyof typeof iconUrls;
    textIcon?: string;
}>();

const iconUrls = {
    modalFilter: new URL('../../../img/modal-filter.svg', import.meta.url).href,
    busGate: new URL('../../../img/bus-gate.svg', import.meta.url).href,
    mobilityLane: new URL('../../../img/bicycle-svgrepo-com.svg', import.meta.url).href,
    tramLine: new URL('../../../img/tram-svgrepo-com.svg', import.meta.url).href,
    busLane: new URL('../../../img/bus-lane.svg', import.meta.url).href,
    carFreeStreet: new URL('../../../img/ban-on-driving-147248.svg', import.meta.url).href,
    schoolStreet: new URL('../../../img/school-street.svg', import.meta.url).href,
    trafficLights: new URL('../../../img/trafficlights-black1.svg', import.meta.url).href,
    pedestrianLights: new URL(
        '../../../img/UK-Traffic-Signal-Pedestrians-1975.svg',
        import.meta.url
    ).href,
    zebraCrossing: new URL('../../../img/zebra-crossing-svgrepo-com.svg', import.meta.url).href
};
</script>

<template>
    <h2>
        <img
            v-if="props.icon"
            :src="iconUrls[props.icon]"
            class="mr-2 inline-block h-10 w-10 object-contain align-middle"
            alt=""
            aria-hidden="true"
        />
        <span
            v-else-if="textIcon"
            class="mr-2 inline-flex h-10 w-10 items-center justify-center align-middle text-sm font-bold"
            >{{ textIcon }}</span
        >
        <slot></slot>
    </h2>
</template>
