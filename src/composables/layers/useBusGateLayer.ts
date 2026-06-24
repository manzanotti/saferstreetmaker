import * as L from 'leaflet';
import { createPointLayer } from './usePointLayer';
import type { IMapLayer } from './IMapLayer';
import { useMapStore } from '../../stores/mapStore';
import { pinia } from '../../stores/index';

export function createBusGateLayer(map: L.Map): IMapLayer {
    const mapStore = useMapStore(pinia);

    return createPointLayer(
        {
            id: 'BusGates',
            title: 'Bus Gates',
            groupName: 'filters',
            buttonId: 'bus-gate',
            tooltip: 'Add bus gates to the map',
            toggleTitle: 'Toggle bus gates from the map',

            buildMarker(latlng, geoJsonLayer) {
                const marker = new L.Marker(latlng, {
                    icon: new L.DivIcon({ className: 'bus-gate-icon' }),
                    draggable: true,
                    pane: 'filters'
                } as any).on('click', (e: any) => {
                    L.DomEvent.stopPropagation(e);
                    geoJsonLayer.removeLayer(e.target);
                    mapStore.markLayerUpdated();
                });
                geoJsonLayer.addLayer(marker);
                return marker;
            },

            buildIconEl() {
                const icon = document.createElement('i');
                icon.classList.add('bus-gate-icon');
                return icon;
            }
        },
        map
    );
}
