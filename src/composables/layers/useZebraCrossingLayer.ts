import * as L from 'leaflet';
import { createPointLayer } from './usePointLayer';
import type { IMapLayer } from './IMapLayer';
import { useMapStore } from '../../stores/mapStore';
import { pinia } from '../../stores/index';

export function createZebraCrossingLayer(map: L.Map): IMapLayer {
    const mapStore = useMapStore(pinia);

    const layer = createPointLayer(
        {
            id: 'ZebraCrossing',
            title: 'Zebra Crossing',
            groupName: 'traffic-controls',
            buttonId: 'zebra-crossing',
            tooltip: 'Add zebra crossings to the map',
            toggleTitle: 'Toggle zebra crossings from the map',

            buildMarker(latlng, geoJsonLayer) {
                const marker = new L.Marker(latlng, {
                    icon: new L.DivIcon({ className: 'zebra-crossing-icon' }),
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
                icon.classList.add('zebra-crossing-icon');
                return icon;
            }
        },
        map
    );

    // Show/hide tooltips based on zoom level (direct map event, no PubSub)
    map.on('zoomend', () => {
        const zoom = map.getZoom();
        layer.getLayer().eachLayer((l: any) => {
            if (zoom < 14) {
                l.closeTooltip?.();
            } else {
                l.openTooltip?.();
            }
        });
    });

    return layer;
}
