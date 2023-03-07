import * as L from 'leaflet';
import PubSub from 'pubsub-js';
import { ToolbarButton } from '../Controls/ToolbarButton';
import { EventTopics } from '../EventTopics';
import { IMapLayer } from "./IMapLayer";

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

        this.setupSubscribers();
    }

    getToolbarButton = (): ToolbarButton => {
        const button = new ToolbarButton();
        {
            button.id = this._prefix;
            button.tooltip = 'Add bus gates to the map';
            button.groupName = this.groupName;
            button.action = this.onButtonClick;
            button.selected = this.selected;
        };

        return button;
    }

    getLegendEntry = (): HTMLElement => {
        const holdingElement = document.createElement('li');
        holdingElement.id = `${this.id}-legend`;
        holdingElement.setAttribute('title', 'Toggle bus gates from the map');

        const icon = document.createElement('i');
        icon.classList.add('bus-gate-icon');
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
        geoJson['features'].forEach((busGate) => {
            const coordinates = busGate.geometry.coordinates;
            const latLng = new L.LatLng(coordinates[1], coordinates[0]);
            this.addMarker(latLng);
        });
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
            if (selectedLayerId !== BusGateLayer.Id) {
                this.deselectLayer();
            } else {
                this.selectLayer();
            }
        });

        PubSub.subscribe(EventTopics.layerDeselected, (msg) => {
            this.deselectLayer();
        });

        PubSub.subscribe(EventTopics.mapClicked, (msg, e: L.LeafletMouseEvent) => {
            if (this.selected) {
                L.DomEvent.stopPropagation(e);
                const latLng = e.latlng;
                this.addMarker(latLng);
                PubSub.publish(EventTopics.layerUpdated, BusGateLayer.Id);
            }
        });
    };

    private addMarker = (latlng: L.LatLng) => {
        const busGate = new L.Marker(latlng, {
            icon: new L.DivIcon({
                className: 'bus-gate-icon'
            }),
            draggable: true,
            pane: 'filters'
        })
            .on('click', (e) => { this.deleteMarker(e); });

        this._layer.addLayer(busGate);
    };

    private deleteMarker = (e) => {
        L.DomEvent.stopPropagation(e);

        const marker = e.target;
        this._layer.removeLayer(marker);
        PubSub.publish(EventTopics.layerUpdated, BusGateLayer.Id);
    };

    private onButtonClick = (e: Event, map: L.Map) => {
        if (this.selected) {
            this.deselectLayer();
            PubSub.publish(EventTopics.layerDeselected, BusGateLayer.Id);
            return;
        }

        this.selected = true;
        this.setCursor();

        PubSub.publish(EventTopics.layerSelected, BusGateLayer.Id);
    }

    private selectLayer = () => {
        this.selected = true;
        this.setCursor();
    }

    private deselectLayer = () => {
        if (!this.selected) {
            return;
        }

        this.removeCursor();
        this.selected = false;
    }

    private setCursor = () => {
        document.getElementById('map')?.classList.remove('leaflet-grab');
        document.getElementById('map')?.classList.add('bus-gate');
    };

    private removeCursor = () => {
        document.getElementById('map')?.classList.remove('bus-gate');
        document.getElementById('map')?.classList.add('leaflet-grab');
    };
}
