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

export class BusGateLayer implements IMapLayer {
    public static Id = 'BusGates';

    public readonly id: string = BusGateLayer.Id;
    public readonly title: string = 'Bus Gates';
    public readonly groupName: string = 'filters';
    public selected: boolean = false;
    public visible: boolean = false;

    private readonly _prefix = 'bus-gate';
    private readonly _layer: L.GeoJSON;

    constructor() {
        this._layer = new L.GeoJSON();
        subscribePointLayerEvents(
            BusGateLayer.Id,
            this,
            this._prefix,
            (latLng) => this.addMarker(latLng)
        );
    }

    getToolbarButton = (): ToolbarButton =>
        buildToolbarButton({
            id: this._prefix,
            tooltip: 'Add bus gates to the map',
            groupName: this.groupName,
            action: this.onButtonClick,
            selected: this.selected,
        });

    getLegendEntry = (): HTMLElement => {
        const icon = document.createElement('i');
        icon.classList.add('bus-gate-icon');
        return buildLegendEntry({
            layerId: this.id,
            title: this.title,
            toggleTitle: 'Toggle bus gates from the map',
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
            icon: new L.DivIcon({ className: 'bus-gate-icon' }),
            draggable: true,
            pane: 'filters',
        }).on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            this._layer.removeLayer(e.target);
            PubSub.publish(EventTopics.layerUpdated, BusGateLayer.Id);
        });
        this._layer.addLayer(marker);
    };

    private onButtonClick = (e: Event, map: L.Map) => {
        if (this.selected) {
            deselectPointLayer(this, this._prefix);
            PubSub.publish(EventTopics.layerDeselected, BusGateLayer.Id);
            return;
        }
        selectLayer(this, this._prefix);
        PubSub.publish(EventTopics.layerSelected, BusGateLayer.Id);
    };
}