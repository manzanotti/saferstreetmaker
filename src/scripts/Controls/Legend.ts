import * as L from 'leaflet';
import { IMapLayer } from '../layers/IMapLayer';

export class Legend {
    static create = (layers: Map<string, IMapLayer>) => {
        const legend = new L.Control({ position: "topright" });

        const div = document.createElement('div');
        div.classList.add('legend');

        const header = document.createElement('h4');
        header.textContent = 'Legend';

        div.appendChild(header);

        let legendEntries: Array<HTMLElement> = [];
        layers.forEach((layer: IMapLayer, key) => {
            legendEntries.push(...layer.getLegendEntry());
        });

        legendEntries.forEach((element: HTMLElement) => {
            div.appendChild(element);
        });

        legend.onAdd = (map) => {
            return div;
        };

        return legend;
    }
}
