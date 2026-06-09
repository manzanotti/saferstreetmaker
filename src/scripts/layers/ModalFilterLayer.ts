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

export class ModalFilterLayer implements IMapLayer {
    public static Id = 'ModalFilters';

    public readonly id: string = ModalFilterLayer.Id;
    public readonly title: string = 'Modal Filters';
    public readonly groupName: string = 'filters';
    public selected: boolean = false;
    public visible: boolean = false;

    private readonly _prefix = 'modal-filter';
    private readonly _layer: L.GeoJSON;

    constructor() {
        this._layer = new L.GeoJSON();
        subscribePointLayerEvents(
            ModalFilterLayer.Id,
            this,
            this._prefix,
            (latLng) => this.addMarker(latLng)
        );
    }

    getToolbarButton = (): ToolbarButton =>
        buildToolbarButton({
            id: this._prefix,
            tooltip: 'Add modal filters to the map',
            groupName: this.groupName,
            action: this.onButtonClick,
            selected: this.selected,
            isFirst: true,
        });

    getLegendEntry = (): HTMLElement => {
        const icon = document.createElement('i');
        icon.innerHTML = `<svg width="30" height="30"><circle cx="10" cy="10" r="7" stroke="green" stroke-width="3" fill="green" fill-opacity=".2" /></svg>`;
        return buildLegendEntry({
            layerId: this.id,
            title: this.title,
            toggleTitle: 'Toggle modal filters from the map',
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

    private addMarker = (latLng: L.LatLng) => {
        const marker = new L.CircleMarker(latLng, {
            color: 'green',
            radius: 10,
            pane: 'filters',
        }).on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            this._layer.removeLayer(e.target);
            PubSub.publish(EventTopics.layerUpdated, ModalFilterLayer.Id);
        });
        this._layer.addLayer(marker);
    };

    private onButtonClick = (event: Event, map: L.Map) => {
        if (this.selected) {
            deselectPointLayer(this, this._prefix);
            PubSub.publish(EventTopics.layerDeselected, ModalFilterLayer.Id);
            return;
        }
        selectLayer(this, this._prefix);
        PubSub.publish(EventTopics.layerSelected, ModalFilterLayer.Id);
    };
}
