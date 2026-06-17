import * as L from 'leaflet';
import { createPointLayer } from './usePointLayer';
import type { IMapLayer } from './IMapLayer';
import { useMapStore } from '../../stores/mapStore';
import { pinia } from '../../stores/index';

export function createModalFilterLayer(map: L.Map): IMapLayer {
  const mapStore = useMapStore(pinia);

  return createPointLayer(
    {
      id: 'ModalFilters',
      title: 'Modal Filters',
      groupName: 'filters',
      buttonId: 'modal-filter',
      tooltip: 'Add modal filters to the map',
      toggleTitle: 'Toggle modal filters from the map',
      isFirst: true,

      buildMarker(latlng, geoJsonLayer) {
        const marker = new L.CircleMarker(latlng, {
          color: 'green',
          radius: 10,
          pane: 'filters',
        }).on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          geoJsonLayer.removeLayer(e.target);
          mapStore.markLayerUpdated();
        });
        geoJsonLayer.addLayer(marker);
        return marker;
      },

      buildIconEl() {
        const icon = document.createElement('i');
        icon.innerHTML = `<svg width="30" height="30"><circle cx="10" cy="10" r="7" stroke="green" stroke-width="3" fill="green" fill-opacity=".2" /></svg>`;
        return icon;
      },
    },
    map,
  );
}
