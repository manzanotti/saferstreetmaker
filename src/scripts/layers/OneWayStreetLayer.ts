import * as L from 'leaflet';
import PubSub from 'pubsub-js';
import { ToolbarButton } from '../Controls/ToolbarButton';
import { EventTopics } from '../EventTopics';
import { IMapLayer } from "./IMapLayer";

export class OneWayStreetLayer implements IMapLayer {
    public static Id = 'OneWayStreets';

    public readonly id: string = OneWayStreetLayer.Id;
    public readonly title: string = 'One-way Streets';
    public readonly groupName: string = '';
    public selected: boolean = false;
    public visible: boolean = false;

    private readonly _prefix = 'one-way-street';
    private readonly _layer: L.GeoJSON;
    private readonly _layerColour = '#000000';

    constructor() {
        this._layer = new L.GeoJSON();

        this.setupSubscribers();
    }

    getToolbarButton = (): ToolbarButton => {
        const button = new ToolbarButton();
        button.id = this._prefix;
        button.tooltip = 'Add one-way streets to the map';
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
            const oneWayStreets = geoJson['features'];
            oneWayStreets.forEach((oneWayStreet) => {
                const points = new Array<L.LatLng>();

                // For a brief period, saving nested the coordinates inside another array, for some reason.
                const coordinates = oneWayStreet.geometry.coordinates.length === 1 ? oneWayStreet.geometry.coordinates[0] : oneWayStreet.geometry.coordinates;
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
            if (selectedLayerId !== OneWayStreetLayer.Id) {
                this.deselectLayer();
            } else {
                this.selectLayer();
            }
        });

        PubSub.subscribe(EventTopics.layerDeselected, (msg) => {
            this.deselectLayer();
        });

        PubSub.subscribe(EventTopics.drawCreated, (msg, data: { latLngs: Array<L.LatLng>, map: L.Map }) => {
            if (this.selected) {
                this.addMarker(data.latLngs);
                PubSub.publish(EventTopics.layerUpdated, OneWayStreetLayer.Id);
            }
        });
    };

    private addMarker = (points: Array<L.LatLng>) => {
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

    private deleteMarker = (layer: L.Draw.Polyline) => {
        this._layer.removeLayer(layer);
        PubSub.publish(EventTopics.layerUpdated, OneWayStreetLayer.Id);
    }

    private markerOnClick = (e) => {
        this.selectLayer();

        const polyline = e.target;
        polyline.editing.enable();
        PubSub.publish(EventTopics.layerSelected, OneWayStreetLayer.Id);
    };

    private onButtonClick = (event: Event, map: L.Map) => {
        if (this.selected) {
            this.deselectLayer();
            PubSub.publish(EventTopics.layerDeselected, OneWayStreetLayer.Id);
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

    private setCursor = () => {
        document.getElementById('map')?.classList.remove('leaflet-grab');
        document.getElementById('map')?.classList.add('one-way-street');
    };

    private removeCursor = () => {
        document.getElementById('map')?.classList.remove('one-way-street');
        document.getElementById('map')?.classList.add('leaflet-grab');
    };
}
