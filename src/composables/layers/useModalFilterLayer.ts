import * as L from 'leaflet';
import { createPointLayer, handlePointFeatureClick } from './usePointLayer';
import type { IMapLayer } from './IMapLayer';

export function createModalFilterLayer(map: L.Map): IMapLayer {
    return createPointLayer(
        {
            id: 'ModalFilters',
            title: 'Modal Filters',
            groupName: 'filters',
            buttonId: 'modal-filter',
            tooltip: 'Add modal filters to the map',
            toggleTitle: 'Toggle modal filters from the map',
            isFirst: true,
            iconSrc: new URL('../../img/modal-filter.svg', import.meta.url).href,

            buildMarker(latlng, geoJsonLayer, _historyId) {
                const marker = new L.CircleMarker(latlng, {
                    color: 'green',
                    radius: 10,
                    className: 'modal-filter-marker',
                    pane: 'filters'
                }).on('click', (e) => handlePointFeatureClick(e, 'ModalFilters'));
                geoJsonLayer.addLayer(marker);
                return marker;
            },

            buildIconEl() {
                const icon = document.createElement('i');
                icon.innerHTML = `<svg width="30" height="30"><circle cx="10" cy="10" r="7" stroke="green" stroke-width="3" fill="green" fill-opacity=".2" /></svg>`;
                return icon;
            }
        },
        map
    );
}
