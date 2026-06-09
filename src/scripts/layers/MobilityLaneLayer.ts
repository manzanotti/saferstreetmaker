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

export class MobilityLaneLayer implements IMapLayer {
    public static Id = 'MobilityLanes';

    public readonly id: string = MobilityLaneLayer.Id;
    public readonly title: string = 'Mobility Lanes';
    public readonly groupName: string = '';
    public selected: boolean = false;
    public visible: boolean = false;

    private readonly _prefix = 'mobility-lane';
    private readonly _layer: L.GeoJSON;
    private readonly _layerColour = '#2222ff';
    private _newLine: L.Draw.Polyline;

    constructor() {
        this._layer = new L.GeoJSON();
        subscribePolylineLayerEvents(
            MobilityLaneLayer.Id,
            this,
            this._prefix,
            this._layer,
            () => this._newLine,
            (data) => {
                this.addMarker(data.latLngs);
                this.initialiseNewLine(data.map);
            }
        );
    }

    getToolbarButton = (): ToolbarButton =>
        buildToolbarButton({
            id: this._prefix,
            tooltip: 'Add mobility lanes to the map',
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
            toggleTitle: 'Toggle mobility lanes from the map',
            iconEl: icon,
            visibilityState: this,
        });
    };

    loadFromGeoJSON = (geoJson: L.GeoJSON) => {
        if (geoJson) {
            const mobilityLanes = geoJson['features'];
            mobilityLanes.forEach((mobilityLane) => {
                const points = new Array<L.LatLng>();
                // For a brief period, saving nested the coordinates inside another array.
                const coordinates = mobilityLane.geometry.coordinates.length === 1 ? mobilityLane.geometry.coordinates[0] : mobilityLane.geometry.coordinates;
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
            PubSub.publish(EventTopics.layerUpdated, MobilityLaneLayer.Id);
        });

        const popup = L.popup({ minWidth: 30, keepInView: false, offset: new L.Point(75, 75) });
        const controlList = document.createElement('ul');
        controlList.classList.add('popup-buttons');

        const deleteControl = document.createElement('li');
        deleteControl.classList.add('delete-button');
        deleteControl.addEventListener('click', () => {
            this._layer.removeLayer(polyline);
            PubSub.publish(EventTopics.layerUpdated, MobilityLaneLayer.Id);
            PubSub.publish(EventTopics.closePopup, popup);
        });
        controlList.appendChild(deleteControl);
        popup.setContent(controlList);

        polyline.on('click', (e) => {
            selectLayer(this, this._prefix);
            e.target.editing.enable();
            PubSub.publish(EventTopics.layerSelected, MobilityLaneLayer.Id);
            popup.setLatLng(e.latlng);
            PubSub.publish(EventTopics.showPopup, popup);
        });

        this._layer.addLayer(polyline);
    };

    private initialiseNewLine = (map: L.Map) => {
        const options = {
            color: this._layerColour,
            weight: 5,
            opacity: 1,
            smoothFactor: 1,
        };
        this._newLine = new L['Draw'].Polyline(map, options);
        this._newLine.enable();
    };

    private onButtonClick = (event: Event, map: L.Map) => {
        if (this.selected) {
            deselectPolylineLayer(this, this._prefix, this._layer, this._newLine);
            PubSub.publish(EventTopics.layerDeselected, MobilityLaneLayer.Id);
            return;
        }
        this.initialiseNewLine(map);
        selectLayer(this, this._prefix);
        PubSub.publish(EventTopics.layerSelected, MobilityLaneLayer.Id);
    };
}