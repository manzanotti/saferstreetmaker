import * as L from 'leaflet';
import { createPointLayer, getPointEventLatLng } from './usePointLayer';
import type { IMapLayer } from './IMapLayer';
import { useMapStore } from '../../stores/mapStore';
import { pinia } from '../../stores/index';

function createIconMarkerLayer(
    id: string,
    title: string,
    groupName: string,
    buttonId: string,
    tooltip: string,
    toggleTitle: string,
    iconClass: string,
    isFirst: boolean,
    map: L.Map
): IMapLayer {
    const mapStore = useMapStore(pinia);

    return createPointLayer(
        {
            id,
            title,
            groupName,
            buttonId,
            tooltip,
            toggleTitle,
            isFirst,

            buildMarker(latlng, geoJsonLayer, _historyId) {
                const marker = new L.Marker(latlng, {
                    icon: new L.DivIcon({ className: iconClass }),
                    draggable: true,
                    pane: 'filters'
                } as any).on('click', (e: any) => {
                    L.DomEvent.stopPropagation(e);
                    const latLng = getPointEventLatLng(e);
                    const historyId = e.target.feature?.properties?.historyId ?? null;
                    geoJsonLayer.removeLayer(e.target);
                    mapStore.markLayerUpdated({
                        kind: 'point-delete',
                        layerId: id,
                        payload: {
                            lat: latLng?.lat ?? null,
                            lng: latLng?.lng ?? null,
                            historyId
                        }
                    });
                });
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
        true,
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
        false,
        map
    );
}
