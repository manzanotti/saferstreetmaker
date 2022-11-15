import * as L from 'leaflet';
import PubSub from 'pubsub-js';
import { EventTopics } from '../EventTopics';

export class FileActions {
    static getActions = (): Array<L.Toolbar2.Action> => {
        const actions: Array<L.Toolbar2.Action> = [];

        const saveFileAction = L.Toolbar2.Action.extend({
            options: {
                toolbarIcon: {
                    html: '<div class="file-actions"></div>',
                    tooltip: 'Save or load files'
                },
                subToolbar: new L.Toolbar2({
                    actions: this.getFileSubMenu()
                })
            }
        });

        actions.push(saveFileAction);

        return actions;
    }

    private static getFileSubMenu = (): Array<L.Toolbar2.Action> => {
        const actions: Array<L.Toolbar2.Action> = [];
        const saveFileAction = L.Toolbar2.Action.extend({
            options: {
                toolbarIcon: {
                    html: '<div class="save-file"></div>',
                    tooltip: 'Save map to a file'
                }
            },

            initialize: function(map, parentAction) {
                this.parentAction = parentAction;
                L.Toolbar2.Action.prototype.initialize.call(this);
            },

            addHooks: function () {
                PubSub.publish(EventTopics.saveMapToFileTopic);
                this.parentAction.disable();
                this.disable();
            }
        });

        actions.push(saveFileAction);

        const saveToGeoJSONFileAction = L.Toolbar2.Action.extend({
            options: {
                toolbarIcon: {
                    html: '<div class="save-geojson-file"></div>',
                    tooltip: 'Save GeoJSON to a file'
                }
            },

            initialize: function(map, parentAction) {
                this.parentAction = parentAction;
                L.Toolbar2.Action.prototype.initialize.call(this);
            },

            addHooks: function () {
                PubSub.publish(EventTopics.saveMapToGeoJSONFileTopic);
                this.parentAction.disable();
                this.disable();
            }
        });

        actions.push(saveToGeoJSONFileAction);

        const loadFileAction = L.Toolbar2.Action.extend({
            options: {
                toolbarIcon: {
                    html: '<div class="load-file"></div>',
                    tooltip: 'Load map from a file'
                }
            },

            initialize: function(map, parentAction) {
                this.parentAction = parentAction;
                L.Toolbar2.Action.prototype.initialize.call(this);
            },

            addHooks: function () {
                PubSub.publish(EventTopics.loadMapFromFileTopic);
                this.parentAction.disable();
                this.disable();
            }
        });

        actions.push(loadFileAction);

        return actions;
    }
}
