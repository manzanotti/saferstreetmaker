import * as L from 'leaflet';
import PubSub from 'pubsub-js';
import { EventTopics } from '../EventTopics';
import { ToolbarButton } from './ToolbarButton';

export class HelpButton {
    public static _prefix: string = 'help';
    public selected: boolean = false;

    constructor() {
    }

    getToolbarButton = (): ToolbarButton => {
        const button = new ToolbarButton();
        {
            button.id = HelpButton._prefix;
            button.tooltip = 'Instructions on how to use the map';
            button.groupName = '';
            button.action = this.onButtonClick;
            button.selected = this.selected;
        };

        return button;
    }

    private onButtonClick = (e: Event, map: L.Map) => {
        if (this.selected) {
            this.selected = false;
            PubSub.publish(EventTopics.hideHelp, null);
            return;
        }

        this.selected = true;
        PubSub.publish(EventTopics.showHelp, this);
    }
}
