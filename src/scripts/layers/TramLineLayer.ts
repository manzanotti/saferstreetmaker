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

export class TramLineLayer implements IMapLayer {
    public static Id = 'TramLines';

    public readonly id: string = TramLineLayer.Id;
    public readonly title: string = 'Tram Lines';
    public readonly groupName: string;
    public selected: boolean = false;
    public visible: boolean = false;

    private readonly _prefix = 'tram-line';
    private readonly _layer: L.GeoJSON;
    private readonly _layerColour = '#ff5e00';

    constructor() {
        this._layer = new L.GeoJSON();
        subscribePolylineLayerEvents(
            TramLineLayer.Id,
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
            tooltip: 'Add tram lines to the map',
            groupName: this.groupName,
            action: this.onButtonClick,
            selected: this.selected,
        });

    getLegendEntry = (): HTMLElement => {
        const icon = document.createElement('i');
        icon.style.backgroundColor = this._layerColour;
        const li = buildLegendEntry({
            layerId: this.id,
            title: this.title,
            toggleTitle: 'Toggle tram lines from the map',
            iconEl: icon,
            visibilityState: this,
        });
        li.appendChild(document.createElement('br'));
        return li;
    };

    loadFromGeoJSON = (geoJson: L.GeoJSON) => {
        if (geoJson) {
            const tramLines = geoJson['features'];
            tramLines.forEach((tramLine) => {
                const points = new Array<L.LatLng>();
                // For a brief period, saving nested the coordinates inside another array, for some reason.
                const coordinates = tramLine.geometry.coordinates.length === 1 ? tramLine.geometry.coordinates[0] : tramLine.geometry.coordinates;
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
            PubSub.publish(EventTopics.layerUpdated, TramLineLayer.Id);
        });

        const popup = L.popup({ minWidth: 30, keepInView: true });
        const controlList = document.createElement('ul');
        controlList.classList.add('popup-buttons');

        const deleteControl = document.createElement('li');
        deleteControl.classList.add('delete-button');
        deleteControl.addEventListener('click', () => {
            this._layer.removeLayer(polyline);
            PubSub.publish(EventTopics.layerUpdated, TramLineLayer.Id);
            PubSub.publish(EventTopics.closePopup, popup);
        });
        controlList.appendChild(deleteControl);
        popup.setContent(controlList);

        polyline.on('click', (e) => {
            selectLayer(this, this._prefix);
            e.target.editing.enable();
            PubSub.publish(EventTopics.layerSelected, TramLineLayer.Id);
            popup.setLatLng(e.latlng);
            PubSub.publish(EventTopics.showPopup, popup);
        });

        this._layer.addLayer(polyline);
    };

    private onButtonClick = (event: Event, map: L.Map) => {
        if (this.selected) {
            deselectPolylineLayer(this, this._prefix, this._layer);
            PubSub.publish(EventTopics.layerDeselected, TramLineLayer.Id);
            return;
        }
        new L['Draw'].Polyline(map, {
            color: this._layerColour,
            weight: 5,
            opacity: 1,
            smoothFactor: 1,
        }).enable();
        selectLayer(this, this._prefix);
        PubSub.publish(EventTopics.layerSelected, TramLineLayer.Id);
    };
}