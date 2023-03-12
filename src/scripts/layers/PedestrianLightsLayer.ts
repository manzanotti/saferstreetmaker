import * as L from 'leaflet';
import PubSub from 'pubsub-js';
import { ToolbarButton } from '../Controls/ToolbarButton';
import { EventTopics } from '../EventTopics';
import { IMapLayer } from "./IMapLayer";

export class PedestrianLightsLayer implements IMapLayer {
    public static Id = 'PedestrianLights';

    public readonly id: string = PedestrianLightsLayer.Id;
    public readonly title: string = 'Pedestrian Lights';
    public readonly groupName: string = 'traffic-controls';
    public selected: boolean = false;
    public visible: boolean = false;

    private readonly _baseCssName = 'pedestrian-lights';
    private readonly _layer: L.GeoJSON;

    constructor() {
        this._layer = new L.GeoJSON();

        this.setupSubscribers();
    }

    getToolbarButton = (): ToolbarButton => {
        const button = new ToolbarButton();
        {
            button.id = this._baseCssName;
            button.tooltip = 'Add pedestrian lights to the map';
            button.groupName = this.groupName;
            button.action = this.onButtonClick;
            button.selected = this.selected;
        };

        return button;
    }

    getLegendEntry = (): HTMLElement => {
        const holdingElement = document.createElement('li');
        holdingElement.id = `${this.id}-legend`;
        holdingElement.setAttribute('title', 'Toggle pedestrian lights from the map');

        const icon = document.createElement('i');
        icon.classList.add(`${this._baseCssName}-icon`);
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
        geoJson['features'].forEach((pedestrianLight) => {
            const coordinates = pedestrianLight.geometry.coordinates;
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
            if (selectedLayerId !== PedestrianLightsLayer.Id) {
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
                PubSub.publish(EventTopics.layerUpdated, PedestrianLightsLayer.Id);
            }
        });
    };

    private addMarker = (latlng: L.LatLng) => {
        const busGate = new L.Marker(latlng, {
            icon: new L.DivIcon({
                className: `${this._baseCssName}-icon`
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
        PubSub.publish(EventTopics.layerUpdated, PedestrianLightsLayer.Id);
    };

    private onButtonClick = (e: Event, map: L.Map) => {
        if (this.selected) {
            this.deselectLayer();
            PubSub.publish(EventTopics.layerDeselected, PedestrianLightsLayer.Id);
            return;
        }

        this.selected = true;
        this.setCursor();

        PubSub.publish(EventTopics.layerSelected, PedestrianLightsLayer.Id);
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
        document.getElementById('map')?.classList.add(this._baseCssName);
    };

    private removeCursor = () => {
        document.getElementById('map')?.classList.remove(this._baseCssName);
        document.getElementById('map')?.classList.add('leaflet-grab');
    };
}
