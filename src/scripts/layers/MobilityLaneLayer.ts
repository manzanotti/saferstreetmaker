import * as L from 'leaflet';
import PubSub from 'pubsub-js';
import { EventTopics } from '../EventTopics';
import { IMapLayer } from "./IMapLayer";

export class MobilityLaneLayer implements IMapLayer {
    public static Id = 'MobilityLanes';
    public readonly id: string;
    public readonly title: string;
    private selected: boolean = false;
    private readonly _layer: L.GeoJSON;
    private readonly _layerColour = '#2222ff';

    constructor() {
        this.id = MobilityLaneLayer.Id;
        this.title = 'Mobility Lanes';
        this._layer = L.geoJSON();

        this.setupSubscribers();
    }

    private setupSubscribers = () => {
        PubSub.subscribe(EventTopics.layerSelected, (msg, selectedLayerId) => {
            if (selectedLayerId !== MobilityLaneLayer.Id) {
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
                PubSub.publish(EventTopics.layerUpdated, MobilityLaneLayer.Id);
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
                PubSub.publish(EventTopics.layerUpdated, MobilityLaneLayer.Id);
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
        PubSub.publish(EventTopics.layerUpdated, MobilityLaneLayer.Id);
    }

    markerOnClick = (e) => {
        this.selectLayer();

        const polyline = e.target;
        polyline.editing.enable();
        PubSub.publish(EventTopics.layerSelected, MobilityLaneLayer.Id);
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
                    html: '<div class="mobility-lane-button"></div>',
                    tooltip: 'Add mobility lanes to the map'
                }
            },

            addHooks: () => {
                if (this.selected) {
                    this.deselectLayer();
                    return;
                }

                const options = {
                    color: this._layerColour,
                    weight: 5,
                    opacity: 1,
                    smoothFactor: 1
                };
                const polyline = new L['Draw'].Polyline(map, options);

                polyline.enable();

                PubSub.publish(EventTopics.layerSelected, MobilityLaneLayer.Id);
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
        document.getElementById('map')?.classList.add('mobility-lane');
    };

    removeCursor = () => {
        document.getElementById('map')?.classList.remove('mobility-lane');
        document.getElementById('map')?.classList.add('leaflet-grab');
    };

    loadFromGeoJSON = (geoJson: L.GeoJSON) => {
        if (geoJson) {
            const mobilityLanes = geoJson['features'];
            mobilityLanes.forEach((mobilityLane) => {
                const points = new Array<L.LatLng>();

                // For a brief period, saving nested the coordinates inside another array, for some reason.
                const coordinates = mobilityLane.geometry.coordinates.length === 1 ? mobilityLane.geometry.coordinates[0] : mobilityLane.geometry.coordinates;
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
