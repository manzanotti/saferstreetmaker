/**
 * Layer factory barrel — creates all 11 map layers for a given Leaflet map.
 * Import this instead of the individual layer files in main.ts.
 */
import type * as L from 'leaflet';
import type { IMapLayer } from './IMapLayer';
import { createModalFilterLayer } from './useModalFilterLayer';
import { createBusGateLayer } from './useBusGateLayer';
import { createTrafficLightsLayer, createPedestrianLightsLayer } from './useTrafficControlLayers';
import { createZebraCrossingLayer } from './useZebraCrossingLayer';
import { createMobilityLaneLayer } from './useMobilityLaneLayer';
import {
    createTramLineLayer,
    createCarFreeStreetLayer,
    createSchoolStreetLayer,
    createOneWayStreetLayer
} from './useSimplePolylineLayers';
import { createLtnLayer } from './useLtnLayer';

export function createAllLayers(map: L.Map): IMapLayer[] {
    return [
        createModalFilterLayer(map),
        createMobilityLaneLayer(map),
        createTramLineLayer(map),
        createCarFreeStreetLayer(map),
        createSchoolStreetLayer(map),
        createOneWayStreetLayer(map),
        createLtnLayer(map),
        createBusGateLayer(map),
        createTrafficLightsLayer(map),
        createPedestrianLightsLayer(map),
        createZebraCrossingLayer(map)
    ];
}
