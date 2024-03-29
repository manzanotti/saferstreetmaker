import * as L from 'leaflet';
import PubSub from 'pubsub-js';
import { ToolbarButton } from '../Controls/ToolbarButton';
import { EventTopics } from '../EventTopics';
import { IMapLayer } from "./IMapLayer";

export class ModalFilterLayer implements IMapLayer {
    public static Id = 'ModalFilters';

    public readonly id: string = ModalFilterLayer.Id;
    public readonly title: string = 'Modal Filters';
    public readonly groupName: string = 'filters';
    public selected: boolean = false;
    public visible: boolean = false;

    private readonly _prefix = 'modal-filter';
    private readonly _layer: L.GeoJSON;
    private readonly _modalFilterIcon: string = `<svg class="modal-filter-button" data-id="${ModalFilterLayer.Id}" width="60" height="60">
            <circle cx="29" cy="29" r="15" stroke="green" stroke-width="3" fill="green" fill-opacity=".2" />
        </svg>`;

    constructor() {
        this._layer = new L.GeoJSON();

        this.setupSubscribers();
    }

    getToolbarButton = (): ToolbarButton => {
        const button = new ToolbarButton();
        button.id = this._prefix;
        button.tooltip = 'Add modal filters to the map';
        button.groupName = this.groupName;
        button.action = this.onButtonClick;
        button.selected = this.selected;
        button.isFirst = true;

        return button;
    }

    getLegendEntry = (): HTMLElement => {
        const holdingElement = document.createElement('li');
        holdingElement.id = `${this.id}-legend`;
        holdingElement.setAttribute('title', 'Toggle Car-free streets from the map');

        const icon = document.createElement('i');
        icon.innerHTML = `<svg width="30" height="30"><circle cx="10" cy="10" r="7" stroke="green" stroke-width="3" fill="green" fill-opacity=".2" /></svg>`;
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
        geoJson['features'].forEach((modelFilter) => {
            const coordinates = modelFilter.geometry.coordinates;
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
        ''
        this._layer.clearLayers();
        this.visible = false;
    };

    private setupSubscribers = () => {
        PubSub.subscribe(EventTopics.layerSelected, (msg, selectedLayerId) => {
            if (selectedLayerId !== ModalFilterLayer.Id) {
                this.deselectLayer();
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
                PubSub.publish(EventTopics.layerUpdated, ModalFilterLayer.Id);
            }
        });
    };

    private addMarker = (latLng: L.LatLng) => {
        const modalFilter = new L.CircleMarker(latLng, {
            draggable: true,
            color: 'green',
            radius: 10,
            pane: 'filters'
        })
            .on('click', (e) => { this.deleteMarker(e); });

        this._layer.addLayer(modalFilter);
    };

    private deleteMarker = (e) => {
        L.DomEvent.stopPropagation(e);

        const marker = e.target;
        this._layer.removeLayer(marker);
        PubSub.publish(EventTopics.layerUpdated, ModalFilterLayer.Id);
    };

    private onButtonClick = (event: Event, map: L.Map) => {
        if (this.selected) {
            this.deselectLayer();
            PubSub.publish(EventTopics.layerDeselected, ModalFilterLayer.Id);
            return;
        }

        this.selectLayer();

        PubSub.publish(EventTopics.layerSelected, ModalFilterLayer.Id);
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
        document.getElementById('map')?.classList.add('modal-filter');
    };

    private removeCursor = () => {
        document.getElementById('map')?.classList.remove('modal-filter');
        document.getElementById('map')?.classList.add('leaflet-grab');
    };
}
