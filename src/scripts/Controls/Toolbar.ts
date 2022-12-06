import * as L from 'leaflet';
import { Settings } from '../../Settings';
import { IMapLayer } from '../layers/IMapLayer';
import { FileActions } from './FileActions';
import { HelpActions } from './HelpActions';
import { SettingsControl } from './SettingsControl';
import { SharingControl } from './SharingControl';

export class Toolbar {
    static create: L.Toolbar2.Control = (map: L.Map, layers: Map<string, IMapLayer>, settings: Settings) => {
        const actions: Array<L.Toolbar2.Action> = [];

        actions.push(...FileActions.getActions());

        if(!settings.readOnly){
            layers.forEach((layer, layerName) => {
                if(settings.activeLayers.includes(layerName)){
                    actions.push(layer.getToolbarAction(map));
                }
            });

            actions.push(...HelpActions.getActions());
        }

        actions.push(SettingsControl.getAction());

        actions.push(SharingControl.getAction());

        const position = settings.readOnly ? 'bottomleft' : 'topleft';

        const toolbar = new L['Toolbar2'].Control({
            position: position,
            actions: actions
        });
        
        return toolbar;
    }
}
