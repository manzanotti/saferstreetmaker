import * as L from 'leaflet';
import { createPointLayer, handlePointFeatureClick } from './usePointLayer';
import type { IMapLayer } from './IMapLayer';

export function createZebraCrossingLayer(map: L.Map): IMapLayer {
    const layer = createPointLayer(
        {
            id: 'ZebraCrossing',
            title: 'Zebra Crossing',
            groupName: 'traffic-controls',
            buttonId: 'zebra-crossing',
            tooltip: 'Add zebra crossings to the map',
            toggleTitle: 'Toggle zebra crossings from the map',
            iconSrc: new URL('../../img/zebra-crossing-svgrepo-com.svg', import.meta.url).href,

            buildMarker(latlng, geoJsonLayer, _historyId) {
                const marker = new L.Marker(latlng, {
                    icon: new L.DivIcon({
                        className: 'zebra-crossing-icon',
                        iconSize: [32, 21],
                        iconAnchor: [16, 10.5]
                    }),
                    draggable: true,
                    pane: 'filters'
                } as any).on('click', (e: any) =>
                    handlePointFeatureClick(
                        e,
                        'ZebraCrossing',
                        new URL('../../img/zebra-crossing-svgrepo-com.svg', import.meta.url).href
                    )
                );
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
