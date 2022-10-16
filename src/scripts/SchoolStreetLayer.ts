import * as L from 'leaflet';
import PubSub from 'pubsub-js';
import { IMapLayer } from "./IMapLayer";

export class SchoolStreetLayer implements IMapLayer {
    public static Id = 'SchoolStreet';
    public readonly id: string;
    public readonly title: string;
    public selected: boolean;
    private readonly _layerSelectedTopic: string;
    private readonly _layerDeselectedTopic: string;
    private readonly _layerUpdatedTopic: string;
    private readonly _showPopupTopic: string;
    private readonly _closePopupTopic: string;
    private readonly _layer: L.GeoJSON;
    private readonly _layerColour = '#E6EA09';

    constructor(layerUpdatedTopic: string, layerSelectedTopic: string, layerDeselectedTopic: string, showPopupTopic: string, closePopupTopic: string) {
        this._layerUpdatedTopic = layerUpdatedTopic;
        this._layerSelectedTopic = layerSelectedTopic;
        this._layerDeselectedTopic = layerDeselectedTopic;
        this._showPopupTopic = showPopupTopic;
        this._closePopupTopic = closePopupTopic;
        this._layer = L.geoJSON();
        
        this.id = SchoolStreetLayer.Id;
        this.title = 'School Streets';
        this.selected = false;

        this.setupSubscribers();
    }

    private setupSubscribers = () => {
        PubSub.subscribe(this._layerSelectedTopic, (msg, data) => {
            if (data !== SchoolStreetLayer.Id) {
                this.selected = false;
            } else {
                this.selected = true;
            }
        });
    };

    addMarker = (points: Array<L.LatLng>) => {
        const polyline = new L.Polyline(points, {
            color: this._layerColour,
            weight: 5,
            opacity: 1,
            smoothFactor: 1
        })
            .on('edit', (e) => {
                PubSub.publish(this._layerUpdatedTopic, SchoolStreetLayer.Id);
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
        PubSub.publish(this._layerUpdatedTopic, SchoolStreetLayer.Id);
    }

    markerOnClick = (e) => {
        this.deselectLayer();

        const polyline = e.target;
        polyline.editing.enable();
        PubSub.publish(this._layerSelectedTopic, SchoolStreetLayer.Id);
    };

    deselectLayer = () => {
        this._layer.eachLayer((layer: L.Draw.Polyline) => {
            layer.editing.disable();
        });

        this.removeCursor();
    }

    getToolbarAction = (map: L.Map) => {
        const modalFilterAction = L['Toolbar2'].Action.extend({
            options: {
                toolbarIcon: {
                    html: '<div class="school-street-button"></div>',
                    tooltip: 'Add school streets to the map'
                }
            },

            addHooks: () => {
                if (this.selected) {
                    this.deselectLayer();
                    this.selected = false;
                    this.removeCursor();
                    PubSub.publish(this._layerDeselectedTopic, SchoolStreetLayer.Id);
                    return;
                }

                this.selected = true;

                const options = {
                    color: this._layerColour,
                    weight: 5,
                    opacity: 1,
                    smoothFactor: 1
                };
                const polyline = new L['Draw'].Polyline(map, options);

                polyline.enable();
                this.setCursor();

                PubSub.publish(this._layerSelectedTopic, SchoolStreetLayer.Id);
            }
        });

        return modalFilterAction;
    };

    setCursor = () => {
        document.getElementById('map')?.classList.remove('leaflet-grab');
        document.getElementById('map')?.classList.add('school-street');
    };

    removeCursor = () => {
        document.getElementById('map')?.classList.remove('school-street');
        document.getElementById('map')?.classList.add('leaflet-grab');
    };

    loadFromGeoJSON = (geoJson: L.GeoJSON) => {
        if (geoJson) {
            const schoolStreets = geoJson['features'];
            schoolStreets.forEach((schoolStreet) => {
                const points = new Array<L.LatLng>();
                const coordinates = schoolStreet.geometry.coordinates;
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