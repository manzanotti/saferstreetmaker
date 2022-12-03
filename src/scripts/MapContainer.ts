import * as L from 'leaflet';
import PubSub from 'pubsub-js';
import { ModalFilterLayer } from './layers/ModalFilterLayer';
import { IMapLayer } from './layers/IMapLayer';
import { FileManager } from './FileManager';
import { MobilityLaneLayer } from './layers/MobilityLaneLayer';
import { TramLineLayer } from './layers/TramLineLayer';
import { CarFreeStreetLayer } from './layers/CarFreeStreetLayer';
import { SchoolStreetLayer } from './layers/SchoolStreetLayer';
import { OneWayStreetLayer } from './layers/OneWayStreetLayer';
import { EventTopics } from './EventTopics';
import { Toolbar } from './Controls/Toolbar';
import { Legend } from './Controls/Legend';
import { Settings } from '../Settings';
import { SettingsControl } from './Controls/SettingsControl';

export class MapContainer {
    private _mapInitialised: boolean = false;
    private _fileManager: FileManager;
    private _map: L.Map;
    private _layers: Map<string, IMapLayer>;
    private _settings: Settings;
    private _settingsControl: L.Control | null = null;
    private _toolbarControl: L.Toolbar2.Control;
    private _legend: L.Control;
    private _overlay: L.Control.Layers;

    constructor(fileManager: FileManager) {
        this._fileManager = fileManager;

        this._map = new L.Map('map');
        this._settings = new Settings();
        this._settings.title = 'Hello Cleveland';

        this.setupLayers();

        this.addTileLayer();
    }

    private addTileLayer = () => {
        const tileLayer = new L.TileLayer('https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 20
        });
        this._map.addLayer(tileLayer);
    };

    private setupLayers = () => {
        this._layers = new Map<string, IMapLayer>;

        this._layers.set(ModalFilterLayer.Id, new ModalFilterLayer());
        this._layers.set(MobilityLaneLayer.Id, new MobilityLaneLayer());
        this._layers.set(TramLineLayer.Id, new TramLineLayer());
        this._layers.set(CarFreeStreetLayer.Id, new CarFreeStreetLayer());
        this._layers.set(SchoolStreetLayer.Id, new SchoolStreetLayer());
        this._layers.set(OneWayStreetLayer.Id, new OneWayStreetLayer());

        this.activateAllLayers();
    };

    private addLayers(settings: Settings){
        this._layers.forEach((layer, layerName) => {
            if(settings.activeLayers.includes(layerName)){
                this._map.addLayer(layer.getLayer());
            }
        });
    }

    private addToolbar = (layers: Map<string, IMapLayer>, settings: Settings) => {
        this._toolbarControl = Toolbar.create(this._map, layers, settings);
        this._map.addControl(this._toolbarControl);
    }

    private addOverlay = (layers: Map<string, IMapLayer>, settings: Settings) => {
        const overlays = {};
        layers.forEach((layer, layerName) => {
            if(settings.activeLayers.includes(layerName)){
                overlays[layer.title] = layer.getLayer();
            }
        });

        this._overlay = new L.Control.Layers(undefined, overlays, { collapsed: false, position: 'bottomright' });
        this._map.addControl(this._overlay);
    };

    private addLegend = (layers: Map<string, IMapLayer>, settings: Settings) => {
        this._legend = Legend.create(layers, settings.activeLayers);
        this._map.addControl(this._legend);
    }

    private removeAllLayers = () => {        
        this._layers.forEach((layer, layerName) => {
            this._map.removeLayer(layer.getLayer());
        });
    }

    private activateAllLayers = () => {
        this._settings.activeLayers = [];
        this._layers.forEach((layer, layerName) => {
            this._settings.activeLayers.push(layerName);
        });
    }

    private resetSettings = () => {
        this._settings.readOnly = false;
        this.activateAllLayers();
    }

    private updateUI = (settings: Settings) => {
        if(this._toolbarControl !== undefined){
            this._map.removeControl(this._toolbarControl);
        }

        if(this._legend !== undefined){
            this._map.removeControl(this._legend);
        }

        if(this._overlay !== undefined){
            this._map.removeControl(this._overlay);
        }

        this.addToolbar(this._layers, settings);
        this.addOverlay(this._layers, settings);
        this.addLegend(this._layers, settings);
    }

    private setupMapEventHandlers = () => {
        this._map.on('click', (e: L.LeafletMouseEvent) => {
            PubSub.publish(EventTopics.mapClicked, e);
        });

        this._map.on('keyup', (e: L.LeafletKeyboardEvent) => {
            if (e.originalEvent.key === 'Escape') {
                PubSub.publish(EventTopics.deselected);
            }
        })

        this._map.on('draw:created', (e) => {
            const layer = e.layer;
            PubSub.publish(EventTopics.drawCreated, layer.getLatLngs());
        });
    }

    private setupSubscribers = () => {
        PubSub.subscribe(EventTopics.fileLoaded, (msg, data) => {
            this.removeAllLayers();
            this.resetSettings();
            if (this.loadMapData(data)) {
                this.saveMap();
                this.updateUI(this._settings);
            };
        });

        PubSub.subscribe(EventTopics.layerUpdated, (msg) => {
            this.saveMap();
        });

        PubSub.subscribe(EventTopics.showPopup, (msg, popup) => {
            this._map.openPopup(popup);
        });

        PubSub.subscribe(EventTopics.closePopup, (msg, popup) => {
            this._map.closePopup(popup);
        });

        PubSub.subscribe(EventTopics.saveMapToFile, (msg) => {
            const centre = this._map.getCenter();
            const zoom = this._map.getZoom();

            this._fileManager.saveMapToFile(this._settings, this._layers, centre, zoom);
        });

        PubSub.subscribe(EventTopics.saveMapToGeoJSONFile, (msg) => {
            this._fileManager.saveMapToGeoJSONFile(this._settings, this._layers);
        });

        PubSub.subscribe(EventTopics.loadMapFromFile, (msg) => {
            this._fileManager.loadMapFromFile();
        });

        PubSub.subscribe(EventTopics.showSettings, (msg) => {
            if (this._settingsControl === null) {
                this._settingsControl = SettingsControl.create(this._settings, this._layers);
                this._map.addControl(this._settingsControl);
            } else {
                this._map.removeControl(this._settingsControl);
                this._settingsControl = null;
            }
        });

        PubSub.subscribe(EventTopics.saveSettings, (msg, settings) => {
            this._settings = settings;
            this.updateUI(settings);

            this.removeAllLayers();
            this.addLayers(settings);

            this.saveMap();

            if (this._settingsControl !== null) {
                this._map.removeControl(this._settingsControl);
                this._settingsControl = null;
            }
        });

        PubSub.subscribe(EventTopics.showHelp, (msg, popup) => {
            this.showHelp();
        });
    }

    setUserLocation = (userLocation: any) => {
        const coordinates = userLocation.coords;
        this._map.setView([coordinates.latitude, coordinates.longitude], 17);
    };

    setDefaultView = () => {
        this._map.setView([52.5, -1.9], 12);
    }

    loadMap = async (remoteMapFile: string | null): Promise<boolean> => {
        if(this._mapInitialised){
            this.removeAllLayers();
            this.resetSettings();
        } else {
            this.addLayers(this._settings);
            this.setupMapEventHandlers();
            this.setupSubscribers();
            this._mapInitialised = true;
        }

        if (remoteMapFile) {
            const mapData = await this._fileManager.loadMapFromRemoteFile(remoteMapFile);
            return this.loadMapData(mapData);
        }

        const lastMapSelected = this._fileManager.loadLastMapSelected();
        const geoJSON = this._fileManager.loadMapFromStorage(lastMapSelected || this._settings.title);
        const mapLoaded = this.loadMapData(geoJSON);

        this.updateUI(this._settings);

        return mapLoaded;
    };

    private loadMapData = (geoJSON): boolean => {
        if (geoJSON === null) {
            return false;
        }

        if (geoJSON['title'] !== undefined) {
            this._settings.title = geoJSON['title'];
        }

        if (geoJSON['settings'] !== undefined) {
            this._settings = geoJSON['settings'];
        }

        if (geoJSON['layers'] !== undefined) {
            const layersJSON = geoJSON['layers'];
            this._layers.forEach((layer, layerName) => {
                if (layerName === ModalFilterLayer.Id && layersJSON['Modals'] !== undefined) {
                    layerName = 'Modals';
                } else if (layerName === MobilityLaneLayer.Id && layersJSON['CycleLanes'] !== undefined) {
                    layerName = 'CycleLanes';
                }

                if (this._settings.activeLayers.includes(layerName)) {
                    const layerJSON = layersJSON[layerName];
                    layer.loadFromGeoJSON(layerJSON);
                    this._map.addLayer(layer.getLayer());
                }
            });
        }

        const centre = geoJSON['centre'];
        const zoom = geoJSON['zoom'];
        this._map.setView([centre.lat, centre.lng], zoom);

        return true;
    }

    private saveMap = () => {
        const centre = this._map.getCenter();
        const zoom = this._map.getZoom();

        this._fileManager.saveMap(this._settings, this._layers, centre, zoom);
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
