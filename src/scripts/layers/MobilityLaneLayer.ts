import * as L from 'leaflet';
import PubSub from 'pubsub-js';
import { EventTopics } from '../EventTopics';
import { IMapLayer } from "./IMapLayer";

export class MobilityLaneLayer implements IMapLayer {
    public static Id = 'MobilityLanes';
    public readonly id: string;
    public readonly title: string;
    public selected: boolean;
    private readonly _eventTopics: EventTopics;
    private readonly _layer: L.GeoJSON;
    private readonly _layerColour = '#2222ff';

    constructor(eventTopics: EventTopics) {
        this._eventTopics = eventTopics;
        this._layer = L.geoJSON();
        this._eventTopics = eventTopics;
        
        this.id = MobilityLaneLayer.Id;
        this.title = 'Mobility Lanes';
        this.selected = false;

        this.setupSubscribers();
    }

    private setupSubscribers = () => {
        PubSub.subscribe(this._eventTopics.layerSelectedTopic, (msg, data) => {
            if (data !== MobilityLaneLayer.Id) {
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
                PubSub.publish(this._eventTopics.layerUpdatedTopic, MobilityLaneLayer.Id);
            });

        const popup = L.popup({ minWidth: 30, keepInView: true });

        const controlList = document.createElement('ul');
        controlList.classList.add('popup-buttons');

        const deleteControl = document.createElement('li');
        deleteControl.classList.add('delete-button');
        deleteControl.addEventListener('click', (e) => {
            this.deleteMarker(polyline);
            PubSub.publish(this._eventTopics.closePopupTopic, popup);
        });

        controlList.appendChild(deleteControl);

        popup.setContent(controlList);

        polyline.on('click', (e) => {
            this.markerOnClick(e);

            popup.setLatLng(e.latlng);
            PubSub.publish(this._eventTopics.showPopupTopic, popup);
        })

        this._layer.addLayer(polyline);
    };

    deleteMarker = (layer: L.Draw.Polyline) => {
        this._layer.removeLayer(layer);
        PubSub.publish(this._eventTopics.layerUpdatedTopic, MobilityLaneLayer.Id);
    }

    markerOnClick = (e) => {
        this.deselectLayer();

        const polyline = e.target;
        polyline.editing.enable();
        PubSub.publish(this._eventTopics.layerSelectedTopic, MobilityLaneLayer.Id);
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
                    html: '<div class="mobility-lane-button"></div>',
                    tooltip: 'Add mobility lanes to the map'
                }
            },

            addHooks: () => {
                if (this.selected) {
                    this.deselectLayer();
                    this.selected = false;
                    this.removeCursor();
                    PubSub.publish(this._eventTopics.layerDeselectedTopic, MobilityLaneLayer.Id);
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

                PubSub.publish(this._eventTopics.layerSelectedTopic, MobilityLaneLayer.Id);
            }
        });

        return modalFilterAction;
    };

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
                const coordinates = mobilityLane.geometry.coordinates;
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
