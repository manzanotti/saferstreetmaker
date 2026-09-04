import * as L from 'leaflet';
import { createPointLayer, handlePointFeatureClick } from './usePointLayer';
import type { IMapLayer } from './IMapLayer';

function createIconMarkerLayer(
    id: string,
    title: string,
    groupName: string,
    buttonId: string,
    tooltip: string,
    toggleTitle: string,
    iconClass: string,
    iconSize: L.PointExpression,
    iconAnchor: L.PointExpression,
    isFirst: boolean,
    iconSrc: string,
    map: L.Map
): IMapLayer {
    return createPointLayer(
        {
            id,
            title,
            groupName,
            buttonId,
            tooltip,
            toggleTitle,
            isFirst,
            iconSrc,

            buildMarker(latlng, geoJsonLayer, _historyId) {
                const marker = new L.Marker(latlng, {
                    icon: new L.DivIcon({
                        className: iconClass,
                        iconSize,
                        iconAnchor
                    }),
                    draggable: true,
                    pane: 'filters'
                } as any).on('click', (e: any) => handlePointFeatureClick(e, id, iconSrc));
                geoJsonLayer.addLayer(marker);
                return marker;
            },

            buildIconEl() {
                const icon = document.createElement('i');
                icon.classList.add(iconClass);
                return icon;
            }
        },
        map
    );
}

export function createTrafficLightsLayer(map: L.Map): IMapLayer {
    return createIconMarkerLayer(
        'TrafficLights',
        'Traffic Lights',
        'traffic-controls',
        'traffic-lights',
        'Add traffic lights to the map',
        'Toggle traffic lights from the map',
        'traffic-lights-icon',
        [30, 30],
        [15, 15],
        true,
        new URL('../../img/trafficlights-black1.svg', import.meta.url).href,
        map
    );
}

export function createPedestrianLightsLayer(map: L.Map): IMapLayer {
    return createIconMarkerLayer(
        'PedestrianLights',
        'Pedestrian Lights',
        'traffic-controls',
        'pedestrian-lights',
        'Add pedestrian lights to the map',
        'Toggle pedestrian lights from the map',
        'pedestrian-lights-icon',
        [30, 30],
        [15, 15],
        false,
        new URL('../../img/UK-Traffic-Signal-Pedestrians-1975.svg', import.meta.url).href,
        map
    );
}
