import * as L from 'leaflet';
import { IMapLayer } from '../layers/IMapLayer';

export class Legend {
    static create = (layers: Map<string, IMapLayer>, activeLayers: Array<string>) => {
        const legend = new L.Control({ position: "topright" });

        const div = document.createElement('div');
        div.classList.add('legend');

        const header = document.createElement('h4');
        header.textContent = 'Legend';

        div.appendChild(header);

        const ul = document.createElement('ul');

        layers.forEach((layer: IMapLayer, layerName) => {
            if (activeLayers.includes(layerName)) {
                ul.appendChild(layer.getLegendEntry());
            }
        });

        div.appendChild(ul);

        const instructions = document.createElement('div');
        instructions.textContent = 'Click item to toggle visibility';
        div.appendChild(instructions);

        legend.onAdd = (map) => {
            return div;
        };

        return legend;
    }
}
