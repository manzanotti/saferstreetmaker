import * as L from 'leaflet';
import PubSub from 'pubsub-js';
import { ModalFilterLayer } from './ModalFilterLayer';
import { IMapLayer } from './IMapLayer';
import { MapManager } from './MapManager';
import { MobilityLaneLayer } from './MobilityLaneLayer';
import { TramLineLayer } from './TramLineLayer';
import { CarFreeStreetLayer } from './CarFreeStreetLayer';
import { SchoolStreetLayer } from './SchoolStreetLayer';

export class MapContainer {
    private _mapManager: MapManager;
    private _map: L.Map;
    private _title: string;
    private _mode: string;
    private _selectedLayer: IMapLayer | null;
    private _layers: Map<string, IMapLayer>;
    private readonly _layerUpdatedTopic = 'LayerUpdatedTopic';
    private readonly _layerSelectedTopic = 'LayerSelectedTopic';
    private readonly _layerDeselectedTopic = 'LayerDeselectedTopic';
    private readonly _showPopupTopic = 'ShowPopup';
    private readonly _closePopupTopic = 'ClosePopup';

    constructor(mapManager: MapManager) {
        this._mapManager = mapManager;

        this._map = L.map('map');
        this._title = 'Hello Cleveland';
        this._mode = '';
        this._selectedLayer = null;

        this._layers = new Map<string, IMapLayer>;

        this.setupMap();
        this.setupModalFilterLayer();
        this.setupMobilityLaneLayer();
        this.setupTramLineLayer();
        this.setupCarFreeStreetLayer();
        this.setupSchoolStreetLayer();

        this.addOverlays();
        this.setupToolbars();
        this.setupMapEventHandlers();
        this.setupSubscribers();
    }

    private setupMap = () => {
        L.tileLayer('https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 20
        }).addTo(this._map);
    };

    private setupToolbars = () => {
        const actions: Array<L.Toolbar2.Action> = [];

        const saveFileAction = L.Toolbar2.Action.extend({
            options: {
                toolbarIcon: {
                    html: '<div class="file-actions"></div>',
                    tooltip: 'Save or load files'
                },
                subToolbar: new L.Toolbar2({
                    actions: this.getFileSubMenu()
                })
            }
        });

        actions.push(saveFileAction);

        this._layers.forEach((layer, key) => {
            actions.push(layer.getToolbarAction(this._map));
        });

        const helpAction = L.Toolbar2.Action.extend({
            options: {
                toolbarIcon: {
                    html: '<div class="help-button"></div>',
                    tooltip: 'Instructions on how to use the map'
                }
            },

            addHooks: () => {
                this.showHelp();
            }
        });

        actions.push(helpAction);
        
        new L.Toolbar2.Control({
            position: 'topleft',
            actions: actions
        }).addTo(this._map);
    }

    private getFileSubMenu = (): Array<L.Toolbar2.Action> => {
        const actions: Array<L.Toolbar2.Action> = [];
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

        const saveToGeoJSONFileAction = L.Toolbar2.Action.extend({
            options: {
                toolbarIcon: {
                    html: '<div class="save-geojson-file"></div>',
                    tooltip: 'Save GeoJSON to a file'
                }
            },

            addHooks: () => {
                const centre = this._map.getCenter();
                const zoom = this._map.getZoom();

                this._mapManager.saveMapToGeoJSONFile(this._title, this._layers, centre, zoom);
            }
        });

        actions.push(saveToGeoJSONFileAction);

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

        return actions;
    }

    private setupModalFilterLayer = () => {
        const modelFilters = new ModalFilterLayer(this._layerUpdatedTopic, this._layerSelectedTopic, this._layerDeselectedTopic);
        this._layers.set(ModalFilterLayer.Id, modelFilters);
    };

    private setupMobilityLaneLayer = () => {
        const mobilityLanes = new MobilityLaneLayer(this._layerUpdatedTopic, this._layerSelectedTopic, this._layerDeselectedTopic, this._showPopupTopic, this._closePopupTopic);
        this._layers.set(MobilityLaneLayer.Id, mobilityLanes);
    };

    private setupTramLineLayer = () => {
        const tramLines = new TramLineLayer(this._layerUpdatedTopic, this._layerSelectedTopic, this._layerDeselectedTopic, this._showPopupTopic, this._closePopupTopic);
        this._layers.set(TramLineLayer.Id, tramLines);
    };

    private setupCarFreeStreetLayer = () => {
        const carFreeStreets = new CarFreeStreetLayer(this._layerUpdatedTopic, this._layerSelectedTopic, this._layerDeselectedTopic, this._showPopupTopic, this._closePopupTopic);
        this._layers.set(CarFreeStreetLayer.Id, carFreeStreets);
    };

    private setupSchoolStreetLayer = () => {
        const schoolStreets = new SchoolStreetLayer(this._layerUpdatedTopic, this._layerSelectedTopic, this._layerDeselectedTopic, this._showPopupTopic, this._closePopupTopic);
        this._layers.set(SchoolStreetLayer.Id, schoolStreets);
    }

    private setupMapEventHandlers = () => {
        this._map.on('click', (e: any) => {
            switch (this._mode) {
                case 'ModalFilters':
                    L.DomEvent.stopPropagation(e);
                    this._selectedLayer?.addMarker([[e.latlng.lng, e.latlng.lat]]);
                    this.saveMap();
                    break;
                default:
                    break;
            }
        });

        this._map.on('keyup', (e: L.LeafletKeyboardEvent) => {
            if (e.originalEvent.key === 'Escape' && this._selectedLayer !== null) {
                this._selectedLayer?.deselectLayer();
                this._selectedLayer = null;
                this._mode = '';
            }
        })

        this._map.on('draw:created', (e) => {
            const layer = e.layer;

            switch (this._mode) {
                case MobilityLaneLayer.Id:
                case TramLineLayer.Id:
                case CarFreeStreetLayer.Id:
                case SchoolStreetLayer.Id:
                    this._selectedLayer?.addMarker(layer.getLatLngs());
                    break;
            }

            this.saveMap();
        });
    }

    private setupSubscribers = () => {
        PubSub.subscribe(this._mapManager.fileLoadedTopic, (msg, data) => {
            this._layers.forEach((layer, layerName) => {
                layer.getLayer().clearLayers();
            });
            if (this.loadMapData(data)) {
                this.saveMap();
            };
        });

        PubSub.subscribe(this._layerSelectedTopic, (msg, data) => {
            this.selectLayer(data);
        });

        PubSub.subscribe(this._layerDeselectedTopic, (msg, data) => {
            this.deselectLayer(data);
        });

        PubSub.subscribe(this._layerUpdatedTopic, (msg, data) => {
            this.saveMap();
        });

        PubSub.subscribe(this._showPopupTopic, (msg, popup) => {
            this._map.openPopup(popup);
        });

        PubSub.subscribe(this._closePopupTopic, (msg, popup) => {
            this._map.closePopup(popup);
        });
    }

    private selectLayer = (layerId: string) => {
        if (this._selectedLayer !== null && this._selectedLayer.id !== layerId) {
            this._selectedLayer.deselectLayer();
        }

        this._selectedLayer = this._layers.get(layerId) || null;
        this._mode = this._selectedLayer?.id || '';
    }

    private deselectLayer = (layerId: string) => {
        this._selectedLayer = null;
        this._mode = '';
    }

    private addOverlays = () => {
        const overlays = {};
        this._layers.forEach((layer, key) => {
            overlays[layer.title] = layer.getLayer();
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
                if (layerName === ModalFilterLayer.Id && layersJSON['Modals'] !== undefined) {
                    layerName = 'Modals';
                } else if(layerName === MobilityLaneLayer.Id && layersJSON['CycleLanes'] !== undefined){
                    layerName = 'CycleLanes';
                }
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

    private showHelp = () => {
        const helpElement = document.getElementById('help');

        if (helpElement?.classList.contains('hide')) {
            helpElement?.classList.remove('hide');
        } else {
            helpElement?.classList.add('hide');
        }
    }
}
