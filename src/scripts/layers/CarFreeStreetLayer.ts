import * as L from 'leaflet';
import PubSub from 'pubsub-js';
import { ToolbarButton } from '../Controls/ToolbarButton';
import { EventTopics } from '../EventTopics';
import { IMapLayer } from "./IMapLayer";
import {
    buildLegendEntry,
    buildToolbarButton,
    deselectPolylineLayer,
    selectLayer,
    subscribePolylineLayerEvents,
} from './LayerHelpers';

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
        subscribePolylineLayerEvents(
            CarFreeStreetLayer.Id,
            this,
            this._prefix,
            this._layer,
            () => null,
            (data) => this.addMarker(data.latLngs)
        );
    }

    getToolbarButton = (): ToolbarButton =>
        buildToolbarButton({
            id: this._prefix,
            tooltip: 'Add car-free streets to the map',
            groupName: this.groupName,
            action: this.onButtonClick,
            selected: this.selected,
        });

    getLegendEntry = (): HTMLElement => {
        const icon = document.createElement('i');
        icon.style.backgroundColor = this._layerColour;
        return buildLegendEntry({
            layerId: this.id,
            title: this.title,
            toggleTitle: 'Toggle car-free streets from the map',
            iconEl: icon,
            visibilityState: this,
        });
    };

    loadFromGeoJSON = (geoJson: L.GeoJSON) => {
        if (geoJson) {
            const carFreeStreets = geoJson['features'];
            carFreeStreets.forEach((carFreeStreet) => {
                const points = new Array<L.LatLng>();
                // For a brief period, the coordinates were incorrectly nested inside another array.
                const coordinates = carFreeStreet.geometry.coordinates.length === 1 ? carFreeStreet.geometry.coordinates[0] : carFreeStreet.geometry.coordinates;
                coordinates.forEach((coordinate: Array<number>) => {
                    points.push(new L.LatLng(coordinate[1], coordinate[0]));
                });
                this.addMarker(points);
            });
        }
    };

    getLayer = (): L.GeoJSON => this._layer;

    toGeoJSON = (): {} => this._layer.toGeoJSON();

    clearLayer = (): void => {
        this._layer.clearLayers();
        this.visible = false;
    };

    private addMarker = (points: Array<L.LatLng>) => {
        const polyline = new L.Polyline(points, {
            color: this._layerColour,
            weight: 10,
            opacity: 1,
            smoothFactor: 1,
        }).on('edit', () => {
            PubSub.publish(EventTopics.layerUpdated, CarFreeStreetLayer.Id);
        });

        const popup = L.popup({ minWidth: 30, keepInView: true });
        const controlList = document.createElement('ul');
        controlList.classList.add('popup-buttons');

        const deleteControl = document.createElement('li');
        deleteControl.classList.add('delete-button');
        deleteControl.addEventListener('click', () => {
            this._layer.removeLayer(polyline);
            PubSub.publish(EventTopics.layerUpdated, CarFreeStreetLayer.Id);
            PubSub.publish(EventTopics.closePopup, popup);
        });
        controlList.appendChild(deleteControl);
        popup.setContent(controlList);

        polyline.on('click', (e) => {
            selectLayer(this, this._prefix);
            e.target.editing.enable();
            PubSub.publish(EventTopics.layerSelected, CarFreeStreetLayer.Id);
            popup.setLatLng(e.latlng);
            PubSub.publish(EventTopics.showPopup, popup);
        });

        this._layer.addLayer(polyline);
    };

    private onButtonClick = (e: Event, map: L.Map) => {
        if (this.selected) {
            deselectPolylineLayer(this, this._prefix, this._layer);
            PubSub.publish(EventTopics.layerDeselected, CarFreeStreetLayer.Id);
            return;
        }
        new L['Draw'].Polyline(map, {
            color: this._layerColour,
            weight: 10,
            opacity: 1,
            smoothFactor: 1,
        }).enable();
        selectLayer(this, this._prefix);
        PubSub.publish(EventTopics.layerSelected, CarFreeStreetLayer.Id);
    };
}