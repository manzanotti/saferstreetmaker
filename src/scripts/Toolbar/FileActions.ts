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

            addHooks: () => {
                PubSub.publish(EventTopics.saveMapToFileTopic);
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

            addHooks: () => {
                PubSub.publish(EventTopics.saveMapToGeoJSONFileTopic);
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

            addHooks: () => {
                PubSub.publish(EventTopics.loadMapFromFileTopic);
            }
        });

        actions.push(loadFileAction);

        return actions;
    }
}
