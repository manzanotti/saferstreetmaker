import * as L from 'leaflet';
import { createPointLayer, handlePointFeatureClick } from './usePointLayer';
import type { IMapLayer } from './IMapLayer';

export function createBusGateLayer(map: L.Map): IMapLayer {
    return createPointLayer(
        {
            id: 'BusGates',
            title: 'Bus Gates',
            groupName: 'filters',
            buttonId: 'bus-gate',
            tooltip: 'Add bus gates to the map',
            toggleTitle: 'Toggle bus gates from the map',
            iconSrc: new URL('../../img/double-decker-bus-svgrepo-com.svg', import.meta.url).href,

            buildMarker(latlng, geoJsonLayer, _historyId) {
                const marker = new L.Marker(latlng, {
                    icon: new L.DivIcon({ className: 'bus-gate-icon' }),
                    draggable: true,
                    pane: 'filters'
                } as any).on('click', (e: any) =>
                    handlePointFeatureClick(
                        e,
                        'BusGates',
                        new URL('../../img/double-decker-bus-svgrepo-com.svg', import.meta.url).href
                    )
                );
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
