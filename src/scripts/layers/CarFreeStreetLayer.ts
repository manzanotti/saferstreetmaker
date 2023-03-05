import * as L from 'leaflet';
import PubSub from 'pubsub-js';
import { ToolbarButton } from '../Controls/ToolbarButton';
import { EventTopics } from '../EventTopics';
import { IMapLayer } from "./IMapLayer";

export class CarFreeStreetLayer implements IMapLayer {
    public static Id = 'CarFreeStreets';

    public readonly id: string = CarFreeStreetLayer.Id;
    public readonly title: string = 'Car-free Streets';
    public readonly groupName: string = '';
    public selected: boolean = false;
    public visible: boolean = false;

    private readonly _prefix = 'car-free-street';
    private readonly _layer: L.GeoJSON;
    private readonly _layerColour = '#00bb00';

    constructor() {
        this._layer = new L.GeoJSON();
        this.setupSubscribers();
    }

    getToolbarButton = (): ToolbarButton => {
        const button = new ToolbarButton();
        button.id = this._prefix;
        button.tooltip = 'Add car-free streets to the map';
        button.groupName = this.groupName;
        button.action = this.onButtonClick;
        button.selected = this.selected;

        return button;
    }

    getLegendEntry = (): HTMLElement => {
        const holdingElement = document.createElement('li');
        holdingElement.id = `${this.id}-legend`;
        holdingElement.setAttribute('title', 'Toggle Car-free streets from the map');

        const icon = document.createElement('i');
        icon.style.backgroundColor = this._layerColour;
        holdingElement.appendChild(icon);

        const text = document.createElement('span');
        text.textContent = this.title;
        holdingElement.appendChild(text);

        holdingElement.addEventListener('click', (e) => {
            if (this.visible) {
                this.visible = false;
                PubSub.publish(EventTopics.hideLayer, this.id);
            } else {
                this.visible = true;
                PubSub.publish(EventTopics.showLayer, this.id);
            }
        });

        return holdingElement;
    }

    loadFromGeoJSON = (geoJson: L.GeoJSON) => {
        if (geoJson) {
            const carFreeStreets = geoJson['features'];
            carFreeStreets.forEach((carFreeStreet) => {
                const points = new Array<L.LatLng>();

                // For a brief period, the coordinates were incorrectly nested inside another array.
                const coordinates = carFreeStreet.geometry.coordinates.length === 1 ? carFreeStreet.geometry.coordinates[0] : carFreeStreet.geometry.coordinates;
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
        this.visible = false;
    };

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

        PubSub.subscribe(EventTopics.layerDeselected, (msg) => {
            if (this.selected) {
                this.deselectLayer();
            }
        });

        PubSub.subscribe(EventTopics.drawCreated, (msg, data: { latLngs: Array<L.LatLng>, map: L.Map }) => {
            if (this.selected) {
                this.addMarker(data.latLngs);
                PubSub.publish(EventTopics.layerUpdated, CarFreeStreetLayer.Id);
            }
        });
    };

    private addMarker = (points: Array<L.LatLng>) => {
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

    private deleteMarker = (layer: L.Draw.Polyline) => {
        this._layer.removeLayer(layer);
        PubSub.publish(EventTopics.layerUpdated, CarFreeStreetLayer.Id);
    }

    private markerOnClick = (e) => {
        this.selectLayer();

        const polyline = e.target;
        polyline.editing.enable();
        PubSub.publish(EventTopics.layerSelected, CarFreeStreetLayer.Id);
    };

    private selectLayer = () => {
        this.selected = true;
        this.setCursor();
    }

    private deselectLayer = () => {
        if (!this.selected) {
            return;
        }

        this._layer.eachLayer((layer: L.Draw.Polyline) => {
            layer.editing.disable();
        });

        this.removeCursor();
        this.selected = false;
    }

    private onButtonClick = (e: Event, map: L.Map) => {
        if (this.selected) {
            this.deselectLayer();
            PubSub.publish(EventTopics.layerDeselected, CarFreeStreetLayer.Id);
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
    }

    private setCursor = () => {
        document.getElementById('map')?.classList.remove('leaflet-grab');
        document.getElementById('map')?.classList.add('car-free-street');
    };

    private removeCursor = () => {
        document.getElementById('map')?.classList.remove('car-free-street');
        document.getElementById('map')?.classList.add('leaflet-grab');
    };
}
