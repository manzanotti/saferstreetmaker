import * as L from 'leaflet';
import 'leaflet-toolbar/src/Toolbar';
import 'leaflet-toolbar/src/Action';
import 'leaflet-toolbar/src/Control';
import 'leaflet-draw';
import PubSub from 'pubsub-js';
import { IMapLayer } from "./IMapLayer";

export class CycleLaneLayer implements IMapLayer {
    public static Id = 'CycleLanes';
    public readonly id: string;
    public readonly title: string;
    public selected: boolean;
    private readonly _layerSelectedTopic: string;
    private readonly _layerDeselectedTopic: string;
    private readonly _layerUpdatedTopic: string;
    private readonly _showPopupTopic: string;
    private readonly _closePopupTopic: string;
    private readonly _layer: L.GeoJSON;
    private readonly _cycleLaneIcon: string;

    constructor(layerUpdatedTopic: string, layerSelectedTopic: string, layerDeselectedTopic: string, showPopupTopic: string, closePopupTopic: string) {
        this._layerUpdatedTopic = layerUpdatedTopic;
        this._layerSelectedTopic = layerSelectedTopic;
        this._layerDeselectedTopic = layerDeselectedTopic;
        this._showPopupTopic = showPopupTopic;
        this._closePopupTopic = closePopupTopic;
        this._cycleLaneIcon = `<svg width="30" height="30"><path stroke='blue' stroke-width='3' stroke-linecap='round' stroke-linejoin='round' fill='blue' fill-opacity='.4' fill-rule='evenodd' d='M12 5 h5v20h-5v-20' /></svg>`;
        this._layer = L.geoJSON();
        
        this.id = CycleLaneLayer.Id;
        this.title = 'Cycle Lanes';
        this.selected = false;

        this.setupSubscribers();
    }

    private setupSubscribers = () => {
        PubSub.subscribe(this._layerSelectedTopic, (msg, data) => {
            if (data !== CycleLaneLayer.Id) {
                this.selected = false;
            } else {
                this.selected = true;
            }
        });
    };

    addMarker = (points: Array<L.LatLng>) => {
        const polyline = new L.Polyline(points, {
            color: '#2222ff',
            weight: 5,
            opacity: 1,
            smoothFactor: 1
        })
            .on('edit', (e) => {
                PubSub.publish(this._layerUpdatedTopic, CycleLaneLayer.Id);
            });

        const popup = L.popup({ minWidth: 30, keepInView: true });

        const controlList = document.createElement('ul');
        controlList.classList.add('popup-buttons');

        const deleteControl = document.createElement('li');
        deleteControl.classList.add('delete-button');
        deleteControl.addEventListener('click', (e) => {
            this.deleteMarker(polyline);
            PubSub.publish(this._closePopupTopic, popup);
        });

        controlList.appendChild(deleteControl);

        popup.setContent(controlList);

        polyline.on('click', (e) => {
            this.markerOnClick(e);

            popup.setLatLng(e.latlng);
            PubSub.publish(this._showPopupTopic, popup);
        })

        this._layer.addLayer(polyline);
    };

    deleteMarker = (layer: L.Draw.Polyline) => {
        this._layer.removeLayer(layer);
        PubSub.publish(this._layerUpdatedTopic, CycleLaneLayer.Id);
    }

    markerOnClick = (e) => {
        this.deselectLayer();

        const polyline = e.target;
        polyline.editing.enable();
        PubSub.publish(this._layerSelectedTopic, CycleLaneLayer.Id);
    };

    deselectLayer = () => {
        this._layer.eachLayer((layer: L.Draw.Polyline) => {
            layer.editing.disable();
        });
    }

    getToolbarAction = (map: L.Map) => {
        const modalFilterAction = L['Toolbar2'].Action.extend({
            options: {
                toolbarIcon: {
                    html: '<div class="mobility-lane-button"></div>',
                    tooltip: 'Add cycle lanes to the map'
                }
            },

            addHooks: () => {
                if (this.selected) {
                    this.deselectLayer();
                    this.selected = false;
                    PubSub.publish(this._layerDeselectedTopic, CycleLaneLayer.Id);
                    return;
                }

                PubSub.publish(this._layerSelectedTopic, CycleLaneLayer.Id);
                this.selected = true;

                const options = {
                    color: '#2222ff',
                    weight: 5,
                    opacity: 1,
                    smoothFactor: 1
                };
                const polyline = new L['Draw'].Polyline(map, options);

                polyline.enable();
            }
        });

        return modalFilterAction;
    };

    loadFromGeoJSON = (geoJson: L.GeoJSON) => {
        if (geoJson) {
            const cycleLanes = geoJson['features'];
            cycleLanes.forEach((cycleLane) => {
                const points = new Array<L.LatLng>();
                const coordinates = cycleLane.geometry.coordinates;
                coordinates.forEach((coordinate) => {
                    const point = new L.LatLng(coordinate[1], coordinate[0]);
                    points.push(point);
                });
                this.addMarker(points);
            });
        }
    };

    getLayer = (): L.GeoJSON => {
        return this._layer;
    };
}
