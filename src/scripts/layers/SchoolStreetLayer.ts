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

export class SchoolStreetLayer implements IMapLayer {
    public static Id = 'SchoolStreet';

    public readonly id: string = SchoolStreetLayer.Id;
    public readonly title: string = 'School Streets';
    public readonly groupName: string = '';
    public selected: boolean = false;
    public visible: boolean = false;

    private readonly _prefix = 'school-street';
    private readonly _layer: L.GeoJSON;
    private readonly _layerColour = '#E6EA09';

    constructor() {
        this._layer = new L.GeoJSON();
        subscribePolylineLayerEvents(
            SchoolStreetLayer.Id,
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
            tooltip: 'Add school streets to the map',
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
            toggleTitle: 'Toggle school streets from the map',
            iconEl: icon,
            visibilityState: this,
        });
    };

    loadFromGeoJSON = (geoJson: L.GeoJSON) => {
        if (geoJson) {
            const schoolStreets = geoJson['features'];
            schoolStreets.forEach((schoolStreet) => {
                const points = new Array<L.LatLng>();
                // For a brief period, saving nested the coordinates inside another array.
                const coordinates = schoolStreet.geometry.coordinates.length === 1 ? schoolStreet.geometry.coordinates[0] : schoolStreet.geometry.coordinates;
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
            weight: 5,
            opacity: 1,
            smoothFactor: 1,
        }).on('edit', () => {
            PubSub.publish(EventTopics.layerUpdated, SchoolStreetLayer.Id);
        });

        const popup = L.popup({ minWidth: 30, keepInView: true });
        const controlList = document.createElement('ul');
        controlList.classList.add('popup-buttons');

        const deleteControl = document.createElement('li');
        deleteControl.classList.add('delete-button');
        deleteControl.addEventListener('click', () => {
            this._layer.removeLayer(polyline);
            PubSub.publish(EventTopics.layerUpdated, SchoolStreetLayer.Id);
            PubSub.publish(EventTopics.closePopup, popup);
        });
        controlList.appendChild(deleteControl);
        popup.setContent(controlList);

        polyline.on('click', (e) => {
            selectLayer(this, this._prefix);
            e.target.editing.enable();
            PubSub.publish(EventTopics.layerSelected, SchoolStreetLayer.Id);
            popup.setLatLng(e.latlng);
            PubSub.publish(EventTopics.showPopup, popup);
        });

        this._layer.addLayer(polyline);
    };

    private onButtonClick = (event: Event, map: L.Map) => {
        if (this.selected) {
            deselectPolylineLayer(this, this._prefix, this._layer);
            PubSub.publish(EventTopics.layerDeselected, SchoolStreetLayer.Id);
            return;
        }
        new L['Draw'].Polyline(map, {
            color: this._layerColour,
            weight: 5,
            opacity: 1,
            smoothFactor: 1,
        }).enable();
        selectLayer(this, this._prefix);
        PubSub.publish(EventTopics.layerSelected, SchoolStreetLayer.Id);
    };
}