<script setup lang="ts">
import HelpFeatureHeading from './HelpFeatureHeading.vue';

defineProps<{
    activeTab: string;
    tabPanelClass: string;
}>();
</script>

<template>
    <div
        id="tabs-features"
        :class="tabPanelClass"
        :data-tab-active="activeTab === 'tabs-features' ? '' : undefined"
        role="tabpanel"
        aria-labelledby="tabs-features-tab"
    >
        <HelpFeatureHeading icon="modalFilter">Modal Filters</HelpFeatureHeading>
        <p class="mb-8">
            Modal filters are designed to stop motorised vehicles from passing. This is usually done
            with either bollards and planters, or Automatic Number Plate Recognition cameras (ANPR).
            To add a modal filter, click the Green Circle button in the toolbar on the left-hand
            side of the map, and just click on the map to place one. Once placed, you can click on
            one to delete it, or drag it to move it.
        </p>
        <HelpFeatureHeading icon="busGate">Bus Gates</HelpFeatureHeading>
        <p class="mb-8">
            Bus gates are designed to stop all motorised vehicles APART FROM BUSES from passing.
            This is usually done with either mechanically raised bollards, or Automatic Number Plate
            Recognition cameras (ANPR). To add a bus gate, right-click or hold the Green Circle
            button in the toolbar on the left-hand side of the map, select the bus icon, and just
            click on the map to place one. Once placed, you can click on one to delete it, or drag
            it to move it.
        </p>
        <HelpFeatureHeading icon="mobilityLane">Mobility Lanes</HelpFeatureHeading>
        <p class="mb-8">
            Most people think of a mobility lane as a cycle lane, and it's true that the majority of
            traffic on them would be people on bicycles. However, by designating them as Mobility
            lanes, this indicates that they are designed to also be used by people using mobility
            scooters, wheelchairs, and electric scooters. And to enable this requires a better
            design of a lane (including being wide enough to allow passing).
        </p>
        <p class="mb-8">
            To add a mobility lane , click on the Cycle button in the toolbar. You draw the lane by
            placing a series of points. When done, click on the last point added, and you will leave
            lane creation mode.
        </p>
        <p class="mb-8">
            To edit a lane, click anywhere on it to enter edit mode. You can click on the fainter
            squares to add an extra point to the line, if you need one. Whilst in edit mode, you
            will see a popup, which currently has a button to delete the whole lane.
        </p>
        <p class="mb-8">
            I find that the best way of placing a lane is to put the start and end points of the
            lane whilst in create mode, click on the last point you added to exit create mode, then
            click anywhere on the line to go into edit mode. You can then place the extra points to
            get the lane exactly where you want it.
        </p>
        <HelpFeatureHeading icon="tramLine">Tram Lines</HelpFeatureHeading>
        <p class="mb-8">
            These work in exactly the same way as mobility lanes. To add one, click on the Tram
            button in the toolbar. You draw the lane by placing a series of points. When done, click
            on the last point added, and you will leave line creation mode.
        </p>
        <HelpFeatureHeading icon="busLane">Bus Lanes</HelpFeatureHeading>
        <p class="mb-8">
            Bus lanes are reserved for buses, helping them move more quickly through busy areas. To
            add one, right-click or hold the currently visible Tram or Bus Lane button in the
            toolbar, select the Bus Lane button, and draw the lane by placing a series of points.
            When done, click on the last point added, and you will leave line creation mode.
        </p>
        <HelpFeatureHeading icon="carFreeStreet">Car-free Streets</HelpFeatureHeading>
        <p class="mb-8">
            These are streets that are not accessible to vehicles (with possible limited exceptions
            for deliveries). Again, these work in exactly the same way as mobility lanes. To add
            one, click on the No Vehicles button in the toolbar. You draw the lane by placing a
            serious of points. When done, click on the last point added, and you will leave line
            creation mode.
        </p>
        <HelpFeatureHeading icon="schoolStreet">School Streets</HelpFeatureHeading>
        <p class="mb-8">
            These are streets around a school that are not accessible to vehicles during drop-off
            and pick-up times. Again, these work in exactly the same way as mobility lanes. To add
            one, click on the No Vehicles button in the toolbar. You draw the lane by placing a
            serious of points. When done, click on the last point added, and you will leave line
            creation mode.
        </p>
        <HelpFeatureHeading text-icon="LTN">LTNs</HelpFeatureHeading>
        <p class="mb-8">
            LTNs, or Low Traffic Neighbourhoods/Healthy Living Zones, are residential areas that
            restrict through-traffic, usually by placing modal filters on a group of roads. They are
            a critical part of a safe cycling network, as they provide a safe cycling environment on
            roads that cannot have mobility lanes on them (often due to on-street parking).
        </p>
        <p class="mb-8">
            Cars can still get to everywhere they could previously, but may have to take a slightly
            longer route.
        </p>
        <p class="mb-8">
            You draw a polygon in much the same way as you draw a line, this time clicking on the
            first point added to complete the shape. Clicking on one allows you to set the label
            text for each LTN block.
        </p>
        <HelpFeatureHeading icon="trafficLights">Traffic Lights</HelpFeatureHeading>
        <p class="mb-8">
            This feature is to define a set of traffic lights used to control traffic at junctions.
            This usually includes phases that allow pedestrians to cross the road, however if you
            want a set of traffic lights that are purely pedestrian crossings, use the Pedestrian
            Crossing Traffic Lights feature.
        </p>
        <p class="mb-8">
            To add a traffic light, click the Traffic Light button in the toolbar on the left-hand
            side of the map, and just click on the map to place one. Once placed, you can click on
            one to delete it, or drag it to move it.
        </p>
        <HelpFeatureHeading icon="pedestrianLights">
            Pedestrian Crossing Traffic Lights
        </HelpFeatureHeading>
        <p class="mb-8">
            This feature is to define a set of traffic lights only used to allow pedestrians to
            cross a road.
        </p>
        <p class="mb-8">
            To add a pedestrian crossing traffic light, right-click or hold the Traffic Light button
            in the toolbar on the left-hand side of the map, click on the Pedestrian Light button,
            and just click on the map to place one. Once placed, you can click on one to delete it,
            or drag it to move it.
        </p>
        <HelpFeatureHeading icon="zebraCrossing">Zebra Crossings</HelpFeatureHeading>
        <p class="mb-8">
            This feature is to define a zebra crossing, to allow pedestrians to safely cross a road.
        </p>
        <p class="mb-8">
            To add a zebra crossing, right-click or hold the Traffic Light button in the toolbar on
            the left-hand side of the map, click on the Zebra Crossing button, and just click on the
            map to place one. Once placed, you can click on one to delete it, or drag it to move it.
        </p>
    </div>
</template>
