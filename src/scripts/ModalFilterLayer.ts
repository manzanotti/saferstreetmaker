import * as L from 'leaflet';
import 'leaflet-svg-shape-markers/src/shapeMarker';
import 'leaflet-svg-shape-markers/src/SVG';
import 'leaflet-toolbar/src/Toolbar';
import 'leaflet-toolbar/src/Action';
import 'leaflet-toolbar/src/Control';
import 'leaflet-path-drag';
import PubSub from 'pubsub-js';
import { IMapLayer } from "./IMapLayer";

export class ModalFilterLayer implements IMapLayer {
    public readonly id: string;
    public readonly title: string;
    public selected: boolean;
    public layerSelectedTopic = 'ModalFilterLayerSelected';
    private readonly _layerUpdatedTopic: string;
    private readonly _layer: L.GeoJSON;
    private readonly _modalFilterIcon: string;

    constructor(layerUpdatedTopic: string) {
        this._layerUpdatedTopic = layerUpdatedTopic;
        this._modalFilterIcon = `<svg width="30" height="30"><circle cx="15" cy="15" r="10" stroke="green" stroke-width="3" fill="green" fill-opacity=".2" /></svg>`;
        this._layer = L.geoJSON();
        this.id = 'Modals';
        this.title = 'Modal Filters';
        this.selected = false;

        this.setupSubscribers();
    }

    private setupSubscribers = () => {
        PubSub.subscribe(this.layerSelectedTopic, (msg, data) => {
            if (data !== this.id) {
                this.selected = false;
            }
        });
    };

    addMarker = (latitude: number, longitude: number) => {
        const modalFilter = new L.CircleMarker([latitude, longitude], {
            draggable: true,
            color: 'green',
            radius: 10
        })
            .on('click', (e) => { this.deleteMarker(e); });
        this._layer.addLayer(modalFilter);

        //PubSub.publish(this._layerUpdatedTopic, this.id);
    };

    deleteMarker = (e) => {
        L.DomEvent.stopPropagation(e);

        const marker = e.target;
        this._layer.removeLayer(marker);
        PubSub.publish(this._layerUpdatedTopic, this.id);
    };

    getToolbarAction = () => {
        const modalFilterAction = L.Toolbar2.Action.extend({
            options: {
                toolbarIcon: {
                    html: this._modalFilterIcon,
                    tooltip: 'Add modal filters to the map'
                }
            },

            addHooks: () => {
                if (this.selected) {
                    this.selected = false;
                    this.removeCursor();
                    return;
                }

                PubSub.publish(this.layerSelectedTopic, this.id);
                this.selected = true;
                this.setCursor();
            }
        });

        return modalFilterAction;
    };

    setCursor = () => {
        document.getElementById('map')?.classList.remove('leaflet-grab');
        document.getElementById('map')?.classList.add('modal-filter');
    };

    removeCursor = () => {
        document.getElementById('map')?.classList.remove('modal-filter');
        document.getElementById('map')?.classList.add('leaflet-grab');
    };

    loadFromGeoJSON = (geoJson: L.GeoJSON) => {
        geoJson['features'].forEach((modelFilter) => {
            const coordinates = modelFilter.geometry.coordinates;
            this.addMarker(coordinates[1], coordinates[0]);
        });
    };

    getLayer = (): L.GeoJSON => {
        return this._layer;
    };
}
