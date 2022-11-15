import * as L from 'leaflet';
import { IMapLayer } from '../layers/IMapLayer';
import { FileActions } from './FileActions';
import { HelpActions } from './HelpActions';

export class Toolbar {
    static create: L.Toolbar2.Control = (map: L.Map, layers: Map<string, IMapLayer>) => {
        const actions: Array<L.Toolbar2.Action> = [];

        actions.push(...FileActions.getActions());

        layers.forEach((layer, key) => {
            actions.push(layer.getToolbarAction(map));
        });

        actions.push(...HelpActions.getActions());

        const toolbar = new L['Toolbar2'].Control({
            position: 'topleft',
            actions: actions
        });
        
        return toolbar;
    }
}
