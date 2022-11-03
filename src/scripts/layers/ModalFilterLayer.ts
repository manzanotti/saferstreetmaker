import * as L from 'leaflet';
import PubSub from 'pubsub-js';
import { EventTopics } from '../EventTopics';
import { IMapLayer } from "./IMapLayer";

export class ModalFilterLayer implements IMapLayer {
    public static Id = 'ModalFilters';
    public readonly id: string;
    public readonly title: string;
    public selected: boolean;
    private readonly _eventTopics: EventTopics;
    private readonly _layer: L.GeoJSON;
    private readonly _modalFilterIcon: string;

    constructor(eventTopics: EventTopics) {
        this._eventTopics = eventTopics;
        this._modalFilterIcon = `<svg width="60" height="60"><circle cx="29" cy="29" r="15" stroke="green" stroke-width="3" fill="green" fill-opacity=".2" /></svg>`;
        this._layer = L.geoJSON();

        this.selected = false;
        this.id = ModalFilterLayer.Id;
        this.title = 'Modal Filters';

        this.setupSubscribers();
    }

    private setupSubscribers = () => {
        PubSub.subscribe(this._eventTopics.layerSelectedTopic, (msg, data) => {
            if (data !== ModalFilterLayer.Id) {
                this.selected = false;
            }
        });
    };

    addMarker = (points: Array<L.LatLng>) => {
        const coordinates = points[0];
        const modalFilter = new L.CircleMarker(coordinates, {
            draggable: true,
            color: 'green',
            radius: 10
        })
            .on('click', (e) => { this.deleteMarker(e); });

        this._layer.addLayer(modalFilter);
    };

    deleteMarker = (e) => {
        L.DomEvent.stopPropagation(e);

        const marker = e.target;
        this._layer.removeLayer(marker);
        PubSub.publish(this._eventTopics.layerUpdatedTopic, ModalFilterLayer.Id);
    };

    deselectLayer = () => {
        this.removeCursor();
    }

    getToolbarAction = (map: L.Map) => {
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

                this.selected = true;
                this.setCursor();

                PubSub.publish(this._eventTopics.layerSelectedTopic, ModalFilterLayer.Id);
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
            const latLng = new L.LatLng(coordinates[1], coordinates[0]);
            this.addMarker([latLng]);
        });
    };

    getLayer = (): L.GeoJSON => {
        return this._layer;
    };

    toGeoJSON = (): {} => {
        return this._layer.toGeoJSON();
    }}
