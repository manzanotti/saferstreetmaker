import * as L from 'leaflet';
import PubSub from 'pubsub-js';
import { ToolbarButton } from '../Controls/ToolbarButton';
import { EventTopics } from '../EventTopics';
import { IMapLayer } from "./IMapLayer";
import {
    buildLegendEntry,
    buildToolbarButton,
    deselectPointLayer,
    selectLayer,
    subscribePointLayerEvents,
} from './LayerHelpers';

export class TrafficLightsLayer implements IMapLayer {
    public static Id = 'TrafficLights';

    public readonly id: string = TrafficLightsLayer.Id;
    public readonly title: string = 'Traffic Lights';
    public readonly groupName: string = 'traffic-controls';
    public selected: boolean = false;
    public visible: boolean = false;

    private readonly _baseCssName = 'traffic-lights';
    private readonly _layer: L.GeoJSON;

    constructor() {
        this._layer = new L.GeoJSON();
        subscribePointLayerEvents(
            TrafficLightsLayer.Id,
            this,
            this._baseCssName,
            (latLng) => this.addMarker(latLng)
        );
    }

    getToolbarButton = (): ToolbarButton =>
        buildToolbarButton({
            id: this._baseCssName,
            tooltip: 'Add traffic lights to the map',
            groupName: this.groupName,
            action: this.onButtonClick,
            selected: this.selected,
            isFirst: true,
        });

    getLegendEntry = (): HTMLElement => {
        const icon = document.createElement('i');
        icon.classList.add(`${this._baseCssName}-icon`);
        return buildLegendEntry({
            layerId: this.id,
            title: this.title,
            toggleTitle: 'Toggle traffic lights from the map',
            iconEl: icon,
            visibilityState: this,
        });
    };

    loadFromGeoJSON = (geoJson: L.GeoJSON) => {
        geoJson['features'].forEach((feature) => {
            const coordinates = feature.geometry.coordinates;
            this.addMarker(new L.LatLng(coordinates[1], coordinates[0]));
        });
    };

    getLayer = (): L.GeoJSON => this._layer;

    toGeoJSON = (): {} => this._layer.toGeoJSON();

    clearLayer = (): void => {
        this._layer.clearLayers();
        this.visible = false;
    };

    private addMarker = (latlng: L.LatLng) => {
        const marker = new L.Marker(latlng, {
            icon: new L.DivIcon({ className: `${this._baseCssName}-icon` }),
            draggable: true,
            pane: 'filters',
        }).on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            this._layer.removeLayer(e.target);
            PubSub.publish(EventTopics.layerUpdated, TrafficLightsLayer.Id);
        });
        this._layer.addLayer(marker);
    };

    private onButtonClick = (e: Event, map: L.Map) => {
        if (this.selected) {
            deselectPointLayer(this, this._baseCssName);
            PubSub.publish(EventTopics.layerDeselected, TrafficLightsLayer.Id);
            return;
        }
        selectLayer(this, this._baseCssName);
        PubSub.publish(EventTopics.layerSelected, TrafficLightsLayer.Id);
    };
}