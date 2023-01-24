import * as L from 'leaflet';
import PubSub from 'pubsub-js';
import { EventTopics } from '../EventTopics';
import { IMapLayer } from "./IMapLayer";

export class CarFreeStreetLayer implements IMapLayer {
    public static Id = 'CarFreeStreets';
    public readonly id: string;
    public readonly title: string;
    public selected: boolean;
    private readonly _layer: L.GeoJSON;
    private readonly _layerColour = '#00bb00';

    constructor() {
        this._layer = L.geoJSON();

        this.id = CarFreeStreetLayer.Id;
        this.title = 'Car-free Streets';
        this.selected = false;

        this.setupSubscribers();
    }

    private setupSubscribers = () => {
        PubSub.subscribe(EventTopics.layerSelected, (msg, selectedLayerId) => {
            if (selectedLayerId !== CarFreeStreetLayer.Id) {
                if (this.selected) {
                    this.deselectLayer();
                }
            } else {
                this.selected = true;
                this.setCursor();
            }
        });

        PubSub.subscribe(EventTopics.deselected, (msg) => {
            if (this.selected) {
                this.deselectLayer();
            }
        });

        PubSub.subscribe(EventTopics.drawCreated, (msg, latLng: L.LatLng) => {
            if (this.selected) {
                this.addMarker([latLng]);
                PubSub.publish(EventTopics.layerUpdated, CarFreeStreetLayer.Id);
            }
        });
    };

    addMarker = (points: Array<L.LatLng>) => {
        const polyline = new L.Polyline(points, {
            color: this._layerColour,
            weight: 10,
            opacity: 1,
            smoothFactor: 1
        })
            .on('edit', (e) => {
                PubSub.publish(EventTopics.layerUpdated, CarFreeStreetLayer.Id);
            });

        const popup = L.popup({ minWidth: 30, keepInView: true });

        const controlList = document.createElement('ul');
        controlList.classList.add('popup-buttons');

        const deleteControl = document.createElement('li');
        deleteControl.classList.add('delete-button');
        deleteControl.addEventListener('click', (e) => {
            this.deleteMarker(polyline);
            PubSub.publish(EventTopics.closePopup, popup);
        });

        controlList.appendChild(deleteControl);

        popup.setContent(controlList);

        polyline.on('click', (e) => {
            this.markerOnClick(e);

            popup.setLatLng(e.latlng);
            PubSub.publish(EventTopics.showPopup, popup);
        })

        this._layer.addLayer(polyline);
    };

    deleteMarker = (layer: L.Draw.Polyline) => {
        this._layer.removeLayer(layer);
        PubSub.publish(EventTopics.layerUpdated, CarFreeStreetLayer.Id);
    }

    markerOnClick = (e) => {
        this.selectLayer();

        const polyline = e.target;
        polyline.editing.enable();
        PubSub.publish(EventTopics.layerSelected, CarFreeStreetLayer.Id);
    };

    selectLayer = () => {
        this.selected = true;
        this.setCursor();
    }

    deselectLayer = () => {
        if (!this.selected) {
            return;
        }

        this._layer.eachLayer((layer: L.Draw.Polyline) => {
            layer.editing.disable();
        });

        this.removeCursor();
        this.selected = false;
    }

    getToolbarAction = (map: L.Map) => {
        const carFreeStreetAction = L['Toolbar2'].Action.extend({
            options: {
                toolbarIcon: {
                    html: '<div class="car-free-street-button"></div>',
                    tooltip: 'Add car-free streets to the map'
                }
            },

            addHooks: () => {
                if (this.selected) {
                    this.deselectLayer();
                    PubSub.publish(EventTopics.deselected, CarFreeStreetLayer.Id);
                    return;
                }

                this.selected = true;

                const options = {
                    color: this._layerColour,
                    weight: 10,
                    opacity: 1,
                    smoothFactor: 1
                };
                const polyline = new L['Draw'].Polyline(map, options);

                polyline.enable();
                this.setCursor();

                PubSub.publish(EventTopics.layerSelected, CarFreeStreetLayer.Id);
                PubSub.publish(EventTopics.layerSelected, CarFreeStreetLayer.Id);
            }
        });

        return carFreeStreetAction;
    };

    getLegendEntry = () => {
        const icon = document.createElement('i');
        icon.style.backgroundColor = this._layerColour;

        const text = document.createElement('span');
        text.textContent = this.title;

        const br = document.createElement('br');

        return [icon, text, br];
    }

    setCursor = () => {
        document.getElementById('map')?.classList.remove('leaflet-grab');
        document.getElementById('map')?.classList.add('car-free-street');
    };

    removeCursor = () => {
        document.getElementById('map')?.classList.remove('car-free-street');
        document.getElementById('map')?.classList.add('leaflet-grab');
    };

    loadFromGeoJSON = (geoJson: L.GeoJSON) => {
        if (geoJson) {
            const carFreeStreets = geoJson['features'];
            carFreeStreets.forEach((carFreeStreet) => {
                const points = new Array<L.LatLng>();
                const coordinates = carFreeStreet.geometry.coordinates;
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

    toGeoJSON = (): {} => {
        return this._layer.toGeoJSON();
    }

    clearLayer = (): void => {
        this._layer.clearLayers();
    };
}
