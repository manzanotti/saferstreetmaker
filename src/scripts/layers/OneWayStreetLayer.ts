import * as L from 'leaflet';
import PubSub from 'pubsub-js';
import { EventTopics } from '../EventTopics';
import { IMapLayer } from "./IMapLayer";

export class OneWayStreetLayer implements IMapLayer {
    public static Id = 'OneWayStreets';
    public readonly id: string;
    public readonly title: string;
    public selected: boolean;
    private readonly _eventTopics: EventTopics;
    private readonly _layer: L.GeoJSON;
    private readonly _layerColour = '#000000';

    constructor() {
        this._layer = L.geoJSON();

        this.id = OneWayStreetLayer.Id;
        this.title = 'One-way Streets';
        this.selected = false;

        this.setupSubscribers();
    }

    private setupSubscribers = () => {
        PubSub.subscribe(EventTopics.layerSelected, (msg, selectedLayerId) => {
            if (selectedLayerId !== OneWayStreetLayer.Id) {
                this.deselectLayer();
            } else {
                this.selectLayer();
            }
        });

        PubSub.subscribe(EventTopics.deselected, (msg) => {
            this.deselectLayer();
        });

        PubSub.subscribe(EventTopics.drawCreated, (msg, latLng: L.LatLng) => {
            if (this.selected) {
                this.addMarker([latLng]);
                PubSub.publish(EventTopics.layerUpdated, OneWayStreetLayer.Id);
            }
        });
    };

    addMarker = (points: Array<L.LatLng>) => {
        const polyline = new L.Polyline(points, {
            color: this._layerColour,
            weight: 2,
            opacity: 1,
            smoothFactor: 1
        }).arrowheads({
            frequency: '50px',
            size: '15px',
            yawn: 40
        })
            .on('edit', (e) => {
                PubSub.publish(EventTopics.layerUpdated, OneWayStreetLayer.Id);
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
        PubSub.publish(EventTopics.layerUpdated, OneWayStreetLayer.Id);
    }

    markerOnClick = (e) => {
        this.selectLayer();

        const polyline = e.target;
        polyline.editing.enable();
        PubSub.publish(EventTopics.layerSelected, OneWayStreetLayer.Id);
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
        const modalFilterAction = L['Toolbar2'].Action.extend({
            options: {
                toolbarIcon: {
                    html: '<div class="one-way-street-button"></div>',
                    tooltip: 'Add one-way streets to the map'
                }
            },

            addHooks: () => {
                if (this.selected) {
                    this.deselectLayer();
                    this.selected = false;
                    this.removeCursor();
                    PubSub.publish(EventTopics.deselected, OneWayStreetLayer.Id);
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

                PubSub.publish(EventTopics.layerSelected, OneWayStreetLayer.Id);
            }
        });

        return modalFilterAction;
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
        document.getElementById('map')?.classList.add('tram-line');
    };

    removeCursor = () => {
        document.getElementById('map')?.classList.remove('tram-line');
        document.getElementById('map')?.classList.add('leaflet-grab');
    };

    loadFromGeoJSON = (geoJson: L.GeoJSON) => {
        if (geoJson) {
            const tramLines = geoJson['features'];
            tramLines.forEach((tramLine) => {
                const points = new Array<L.LatLng>();
                const coordinates = tramLine.geometry.coordinates;
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
}
