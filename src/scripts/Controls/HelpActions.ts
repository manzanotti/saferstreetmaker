import * as L from 'leaflet';
import PubSub from 'pubsub-js';
import { EventTopics } from '../EventTopics';

export class HelpActions {
    static getActions = (): Array<L.Toolbar2.Action> => {
        const actions: Array<L.Toolbar2.Action> = [];

        const helpAction = L.Toolbar2.Action.extend({
            options: {
                toolbarIcon: {
                    html: '<div class="help-button"></div>',
                    tooltip: 'Instructions on how to use the map'
                }
            },

            addHooks: () => {
                PubSub.publish(EventTopics.showHelp);
            }
        });

        actions.push(helpAction);

        return actions;
    }
}
