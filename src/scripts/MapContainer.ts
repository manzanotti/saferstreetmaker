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
import { SharingControl } from './Controls/SharingControl';

export class MapContainer {
    private _mapInitialised: boolean = false;
    private _fileManager: FileManager;
    private _map: L.Map;
    private _layers: Map<string, IMapLayer>;
    private _settings: Settings;
    private _settingsControl: L.Control | null = null;
    private _sharingControl: L.Control | null = null;
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

        this.setupCloseHelpButtons();
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

    private addLayers(settings: Settings) {
        this._layers.forEach((layer, layerName) => {
            if (settings.activeLayers.includes(layerName)) {
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
            if (settings.activeLayers.includes(layerName)) {
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

    private setupCloseHelpButtons = () => {
        document.getElementsByName('closeHelp').forEach((element: HTMLElement) => {
            element.addEventListener('click', (e: Event) => {
                this.showPopup('help');
            })
        });
    }

    private clearAllLayers = () => {
        this._layers.forEach((layer, layerName) => {
            layer.clearLayer();
            this._map.removeLayer(layer.getLayer());
        });
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
        if (this._toolbarControl !== undefined) {
            this._map.removeControl(this._toolbarControl);
        }

        if (this._legend !== undefined) {
            this._map.removeControl(this._legend);
        }

        if (this._overlay !== undefined) {
            this._map.removeControl(this._overlay);
        }

        if (!settings.hideToolbar) {
            this.addToolbar(this._layers, settings);
        }
        
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
            this.clearAllLayers();
            this.resetSettings();

            let mapLoaded = false;
            const errors = new Array<string>();

            try {
                mapLoaded = this.loadMapData(data);
            } catch (e: any) {
                errors.push('There was a problem loading the map from uploaded file:');
                errors.push(e.message);
                errors.push(e.stack);

                this.showErrors(errors);
            }

            if (mapLoaded) {
                this.saveMap();
                this.updateUI(this._settings);
            }
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
            try {
            this._fileManager.loadMapFromFile();
            } catch (e: any) {
                const errors = new Array<string>();
                errors.push('There was a problem loading the map from uploaded file:');
                errors.push(e.message);
                errors.push(e.stack);

                this.showErrors(errors);
            }
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

        PubSub.subscribe(EventTopics.showSharingPopup, (msg) => {
            if (this._sharingControl === null) {
                const hash = this.saveMapToHash();
                this._sharingControl = SharingControl.create(hash, this._settings.title);
                this._map.addControl(this._sharingControl);
            } else {
                this._map.removeControl(this._sharingControl);
                this._sharingControl = null;
            }
        });

        PubSub.subscribe(EventTopics.showHelp, (msg) => {
            this.showPopup('help');
        });
    }

    setUserLocation = (userLocation: any) => {
        const coordinates = userLocation.coords;
        this._map.setView([coordinates.latitude, coordinates.longitude], 17);
    };

    setDefaultView = () => {
        this._map.setView([52.5, -1.9], 12);
    }

    loadMap = async (remoteMapFile: string | null, hash: string, hideToolbar: boolean): Promise<boolean> => {
        if (this._mapInitialised) {
            this.removeAllLayers();
            this.resetSettings();
        } else {
            this.addLayers(this._settings);
            this.setupMapEventHandlers();
            this.setupSubscribers();
            this._mapInitialised = true;
        }

        let mapLoaded = false;

        let geoJSON = '';
        const errors = new Array<string>();
        let errorIntro = '';
        let loadingFromStorage = false;
        try {
        if (remoteMapFile) {
                errorIntro = 'There was a problem loading the map from the remote file location:';
                geoJSON = await this._fileManager.loadMapFromRemoteFile(remoteMapFile);
            } else if (hash !== '') {
                errorIntro = 'There was a problem loading the map from the hash:';
                geoJSON = this._fileManager.loadMapFromHash(hash.slice(1));
        } else {
                loadingFromStorage = true;
            const lastMapSelected = this._fileManager.loadLastMapSelected();
                errorIntro = 'There was a problem loading the map from local storage:';
                geoJSON = this._fileManager.loadMapFromStorage(lastMapSelected || this._settings.title);
            }

            errorIntro = 'There was a problem processing the map file:';
            mapLoaded = this.loadMapData(geoJSON);
        } catch (e: any) {
            errors.push(errorIntro);

            if (loadingFromStorage) {
                errors.push('<a id="downloadErrorFile">Click to download the map from local storage</a>')
            }

            errors.push(e.message);
            errors.push(e.stack);

            this.showErrors(errors);

            if (loadingFromStorage) {
                const downloadLink = document.getElementById('downloadErrorFile');

                downloadLink?.addEventListener('click', (e) => {
                    this.downloadStorageMap();
                });
            }
        }

        this._settings.hideToolbar = hideToolbar;

        this.updateUI(this._settings);

        return mapLoaded;
    };

    downloadStorageMap = () => {
        const lastMapSelected = this._fileManager.loadLastMapSelected();
        const mapJSON = this._fileManager.loadMapFromStorage(lastMapSelected);

        const mapString = JSON.stringify(mapJSON);

        const blob = new Blob([mapString], { type: 'text/plain;charset=utf-8' });
        const hyperlink = document.createElement("a");
        hyperlink.href = URL.createObjectURL(blob);
        hyperlink.download = `invalidMapData.json`;
        hyperlink.click();
    }

    saveMapToHash = () => {
        const centre = this._map.getCenter();
        const zoom = this._map.getZoom();
        return this._fileManager.saveMapToHash(this._settings, this._layers, centre, zoom);
    }

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

    private showErrors = (errorMessages: Array<string>) => {
        const errorMessagesElement = document.getElementById('errorMessages');

        if (errorMessagesElement !== null) {
            errorMessagesElement.innerHTML = errorMessages.join('<br />');

            this.showPopup('errors');
        }
    }

    private showPopup = (popupId: string) => {
        const popupElement = document.getElementById(popupId);

        if (popupElement === null) {
            return;
        }

        if (popupElement.classList.contains('fadeOut')) {
            popupElement.classList.remove('fadeOut');
            popupElement?.classList.add('fadeIn');
        } else {
            popupElement?.classList.remove('fadeIn');
            popupElement.classList.add('fadeOut');
        }
    }
}
