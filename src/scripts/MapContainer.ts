import * as L from 'leaflet';
import PubSub from 'pubsub-js';
import { ModalFilterLayer } from './ModalFilterLayer';
import { IMapLayer } from './IMapLayer';
import { MapManager } from './MapManager';

export class MapContainer {
    private _mapManager: MapManager;
    private _map: L.Map;
    private _title: string;
    private _mode: string;
    private _selectedLayer: IMapLayer | null;
    private _layers: Map<string, IMapLayer>;
    private readonly _layerUpdatedTopic = 'LayerUpdatedTopic';

    constructor(mapManager: MapManager) {
        this._mapManager = mapManager;

        this._map = L.map('map');
        this._title = 'Hello Cleveland';
        this._mode = '';
        this._selectedLayer = null;

        this._layers = new Map<string, IMapLayer>;

        this.setupMap();
        this.setupModalFilterLayer();

        this.addOverlays();
        this.setupToolbars();

        this._map.addEventListener('click', (e: any) => {
            switch (this._mode) {
                case 'modalFilters':
                    this._selectedLayer?.addMarker(e.latlng.lat, e.latlng.lng);
                    this.saveMap();
                    break;
            }
        });

        PubSub.subscribe(mapManager.fileLoadedTopic, (msg, data) => {
            if(this.loadMapData(data)) {
                this.saveMap();
            };
        });

        PubSub.subscribe(this._layerUpdatedTopic, (msg, data) => {
            this.saveMap();
        });
    }

    private setupMap = () => {
        L.tileLayer('https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(this._map);
    };

    private setupToolbars = () => {
        const actions: Array<IMapLayer> = [];

        const saveFileAction = L.Toolbar2.Action.extend({
            options: {
                toolbarIcon: {
                    html: '<div class="save-file"></div>',
                    tooltip: 'Save map to a file'
                }
            },

            addHooks: () => {
                const centre = this._map.getCenter();
                const zoom = this._map.getZoom();
        
                this._mapManager.saveMapToFile(this._title, this._layers, centre, zoom);
            }
        });

        actions.push(saveFileAction);

        const loadFileAction = L.Toolbar2.Action.extend({
            options: {
                toolbarIcon: {
                    html: '<div class="load-file"></div>',
                    tooltip: 'Load map from a file'
                }
            },

            addHooks: () => {
                this._mapManager.loadMapFromFile();
            }
        });

        actions.push(loadFileAction);

        this._layers.forEach((layer, key) => {
            actions.push(layer.getToolbarAction());
        });

        new L.Toolbar2.Control({
            position: 'topleft',
            actions: actions
        }).addTo(this._map);
    };

    private setupModalFilterLayer = () => {
        const modelFilters = new ModalFilterLayer(this._layerUpdatedTopic);
        this._layers.set(modelFilters.id, modelFilters);

        PubSub.subscribe(modelFilters.layerSelectedTopic, (msg, data) => {
            if (data === modelFilters.id) {
                this._selectedLayer = modelFilters;
                this._mode = 'modalFilters';
            }
        });
    };

    private addOverlays = () => {
        const overlays = {};
        this._layers.forEach((layer, key) => {
            overlays[key] = layer.getLayer();
            this._map.addLayer(layer.getLayer());
        });

        L.control.layers(undefined, overlays, { collapsed: false }).addTo(this._map);
    };

    setUserLocation = (userLocation: any) => {
        const coordinates = userLocation.coords;
        this._map.setView([coordinates.latitude, coordinates.longitude], 17);
    };

    loadMap = (): boolean => {
        const lastMapSelected = this._mapManager.loadLastMapSelected();
        const geoJSON = this._mapManager.loadMapFromStorage(lastMapSelected || this._title);

        return this.loadMapData(geoJSON);
    };

    private loadMapData = (geoJSON): boolean => {
        if (geoJSON === null) {
            this._mapManager.saveLastMapSelected(this._title);
            return false;
        }

        if (geoJSON['title'] !== undefined) {
            this._title = geoJSON['title'];
            const centre = geoJSON['centre'];
            const zoom = geoJSON['zoom'];
            this._map.setView([centre.lat, centre.lng], zoom);
        }

        if (geoJSON['layers'] !== undefined) {
            const layersJSON = geoJSON['layers'];
            this._layers.forEach((layer, layerName) => {
                const layerJSON = layersJSON[layerName];
                layer.loadFromGeoJSON(layerJSON);
            });
        }

        this._selectedLayer = null;
        return true;
    }

    private saveMap = () => {
        const centre = this._map.getCenter();
        const zoom = this._map.getZoom();

        this._mapManager.saveMap(this._title, this._layers, centre, zoom);
    };
}
