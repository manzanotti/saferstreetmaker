import * as L from 'leaflet';
import { IMapLayer } from '../layers/IMapLayer';

export class Legend {
  static create = (layers: Map<string, IMapLayer>, activeLayers: Array<string>) => {
    const legend = new L.Control({ position: 'topright' });

    const div = document.createElement('div');
    div.classList.add('legend');
    L.DomEvent.disableClickPropagation(div);
    L.DomEvent.disableScrollPropagation(div);

    const header = document.createElement('h4');
    header.textContent = 'Legend';
    header.classList.add('legend-title');
    header.addEventListener('click', () => {
      div.classList.toggle('collapsed');
      const content = div.querySelector('.legend-content');
      if (content) {
        content.classList.toggle('hidden');
      }
    });

    div.appendChild(header);

    const content = document.createElement('div');
    content.classList.add('legend-content');

    const ul = document.createElement('ul');

    layers.forEach((layer: IMapLayer, layerName) => {
      if (activeLayers.includes(layerName)) {
        ul.appendChild(layer.getLegendEntry());
      }
    });

    content.appendChild(ul);

    const instructions = document.createElement('div');
    instructions.textContent = 'Click item to toggle visibility';
    content.appendChild(instructions);

    div.appendChild(content);

    legend.onAdd = (map) => {
      return div;
    };

    return legend;
  };
}
