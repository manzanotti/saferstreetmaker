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
import { LtnLayer } from './layers/LtnLayer';
import { BusGateLayer } from './layers/BusGateLayer';
import { IModalWindow } from './Controls/IModalWindow';
import { ToolbarButton } from './Controls/ToolbarButton';
import { HelpButton } from './Controls/HelpButton';
import { MapManagerControl } from './Controls/MapManagerControl';

export class MapContainer {
    private static _version: string = '0.7.0';
    private _mapInitialised: boolean = false;
    private _fileManager: FileManager;
    private _map: L.Map;
    private _layers: Map<string, IMapLayer>;
    private _settings: Settings;
    private _toolbarControl: L.Control;
    private _legend: L.Control;
    private _helpButton: HelpButton;

    private _modalWindows: Array<IModalWindow>;

    constructor(fileManager: FileManager) {
        this._fileManager = fileManager;

        this._settings = new Settings();
        this._settings.title = 'Hello Cleveland';

        this._map = new L.Map('map');

        this.setupPanes(this._map);

        this.setupLayers();

        this._helpButton = new HelpButton();

        this.setupModalWindowControls();

        this.addTileLayer();

        this.setupCloseHelpButtons();
    }

    private setupPanes = (map: L.Map) => {
        const ltnsPane = map.createPane('ltns');
        ltnsPane.style.zIndex = '300';

        const filtersPane = map.createPane('filters');
        filtersPane.style.zIndex = '500';
    }

    private setupLayers = () => {
        this._layers = new Map<string, IMapLayer>;

        this._layers.set(ModalFilterLayer.Id, new ModalFilterLayer());
        this._layers.set(MobilityLaneLayer.Id, new MobilityLaneLayer());
        this._layers.set(TramLineLayer.Id, new TramLineLayer());
        this._layers.set(CarFreeStreetLayer.Id, new CarFreeStreetLayer());
        this._layers.set(SchoolStreetLayer.Id, new SchoolStreetLayer());
        this._layers.set(OneWayStreetLayer.Id, new OneWayStreetLayer());
        this._layers.set(LtnLayer.Id, new LtnLayer());
        this._layers.set(BusGateLayer.Id, new BusGateLayer());

        this.activateAllLayers();
    };

    private setupModalWindowControls = () => {
        this._modalWindows = new Array<IModalWindow>();

        const mapManagerControl = new MapManagerControl(this._fileManager);
        this._modalWindows.push(mapManagerControl);

        const settingsControl = new SettingsControl();
        this._modalWindows.push(settingsControl);

        const sharingControl = new SharingControl(this._fileManager);
        this._modalWindows.push(sharingControl);
    }

    private addTileLayer = () => {
        const tileLayer = new L.TileLayer('https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
            attribution: '<a href="https://saferstreetmaker.org" target="_blank">saferstreetmaker.org</a> | &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
            maxZoom: 20
        });
        this._map.addLayer(tileLayer);
    };

    private addLayers(settings: Settings) {
        this._layers.forEach((layer, layerName) => {
            if (settings.activeLayers.includes(layerName)) {
                layer.visible = true;
                const layerToAdd = layer.getLayer();

                this._map.addLayer(layerToAdd);
            }
        });
    }

    private addToolbar = (layers: Map<string, IMapLayer>, settings: Settings, modalWindows: Array<IModalWindow>) => {
        const otherButtons = new Array<ToolbarButton>();
        otherButtons.push(this._helpButton.getToolbarButton());

        this._toolbarControl = Toolbar.createToolbarControl(layers, settings, modalWindows, otherButtons);
        this._map.addControl(this._toolbarControl);
    }

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
        this.refreshToolbar(settings);
        this.refreshLegend(settings);
    }

    private refreshToolbar = (settings: Settings) => {
        if (this._toolbarControl !== undefined) {
            this._map.removeControl(this._toolbarControl);
        }

        if (!settings.hideToolbar) {
            this.addToolbar(this._layers, settings, this._modalWindows);
        }
    }

    private refreshLegend = (settings: Settings) => {
        if (this._legend !== undefined) {
            this._map.removeControl(this._legend);
        }

        this.addLegend(this._layers, settings);
    }

    private toggleModalWindowVisibility = (windowToShow: IModalWindow | null) => {
        this._modalWindows.forEach((modalWindow) => {
            if (windowToShow === null || modalWindow.id !== windowToShow.id) {
                modalWindow.selected = false;
                this._map.removeControl(modalWindow.getControl());
            }
        });

        this.refreshToolbar(this._settings);
    }

    private setupMapEventHandlers = () => {
        this._map.on('click', (e: L.LeafletMouseEvent) => {
            PubSub.publish(EventTopics.mapClicked, e);
        });

        this._map.on('keyup', (e: L.LeafletKeyboardEvent) => {
            if (e.originalEvent.key === 'Escape') {
                this._map.closePopup();
                PubSub.publish(EventTopics.layerDeselected);
            }
        })

        this._map.on('draw:created', (e) => {
            const layer = e.layer;
            PubSub.publish(EventTopics.drawCreated, { latLngs: layer.getLatLngs(), map: this._map });
        });

        this._map.on('zoomend', (e) => {
            const zoom = this._map.getZoom();
            PubSub.publish(EventTopics.mapZoomChanged, zoom);
        });
    }

    private setupSubscribers = () => {
        PubSub.subscribe(EventTopics.fileLoaded, (msg, data) => {
            this.toggleModalWindowVisibility(null);
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

            this._fileManager.saveMapToFile(this._settings, this._layers);

            this.toggleModalWindowVisibility(null);
        });

        PubSub.subscribe(EventTopics.saveMapToGeoJSONFile, (msg) => {
            this._fileManager.saveMapToGeoJSONFile(this._settings, this._layers);

            this.toggleModalWindowVisibility(null);
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

        PubSub.subscribe(EventTopics.hideModalWindows, (msg, windowToShow: IModalWindow | null) => {
            this.toggleModalWindowVisibility(windowToShow);
        });

        PubSub.subscribe(EventTopics.showSettings, (msg, settingsControl: SettingsControl) => {
            this.toggleModalWindowVisibility(settingsControl);
            settingsControl.update(this._settings, this._layers);
            this._map.addControl(settingsControl.getControl());
        });

        PubSub.subscribe(EventTopics.saveSettings, (msg, settings: Settings) => {
            this._settings = settings;
            this.updateUI(settings);

            this.removeAllLayers();
            this.addLayers(settings);

            this.saveMap();

            this.toggleModalWindowVisibility(null);
        });

        PubSub.subscribe(EventTopics.showMapManager, (msg, mapManagerControl: MapManagerControl) => {
            this.toggleModalWindowVisibility(mapManagerControl);
            mapManagerControl.update(this._settings, this._layers);
            this._map.addControl(mapManagerControl.getControl());
        });

        PubSub.subscribe(EventTopics.createNewMap, (msg, settings: Settings) => {
            this._settings = settings;
            this.updateUI(settings);

            this.clearAllLayers();
            this.removeAllLayers();
            this.addLayers(settings);

            this.saveMap();

            this.toggleModalWindowVisibility(null);
        });

        PubSub.subscribe(EventTopics.showSharingPopup, (msg, sharingControl: SharingControl) => {
            this.toggleModalWindowVisibility(sharingControl);
            sharingControl.update(this._settings, this._layers);
            this._map.addControl(sharingControl.getControl());
        });

        PubSub.subscribe(EventTopics.showHelp, (msg) => {
            this.refreshToolbar(this._settings);
            this.showPopup('help');
        });

        PubSub.subscribe(EventTopics.hideHelp, (msg) => {
            this.refreshToolbar(this._settings);
            this.showPopup('help');
        });

        PubSub.subscribe(EventTopics.hideLayer, (msg, layerId) => {
            var layer = this._layers.get(layerId);
            if (layer !== undefined) {
                this._map.removeLayer(layer.getLayer());
                document.getElementById(`${layerId}-legend`)?.classList.add('disabled');
            }
        });

        PubSub.subscribe(EventTopics.showLayer, (msg, layerId) => {
            var layer = this._layers.get(layerId);
            if (layer !== undefined) {
                const layerToAdd = layer.getLayer();
                this._map.addLayer(layerToAdd);
                document.getElementById(`${layerId}-legend`)?.classList.remove('disabled');
            }
        });

        PubSub.subscribe(EventTopics.layerDeselected, (msg) => {
            this.refreshToolbar(this._settings);
        });

        PubSub.subscribe(EventTopics.layerSelected, (msg) => {
            this.refreshToolbar(this._settings);
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

                const layerJSON = layersJSON[layerName];
                if (layerJSON) {
                    layer.loadFromGeoJSON(layerJSON);
                }
                if (this._settings.activeLayers.includes(layerName)) {
                    this._map.addLayer(layer.getLayer());
                } else {
                    this._map.removeLayer(layer.getLayer());
                }
            });
        }

        if (this._settings && !this._settings.centre) {
            this._settings.centre = geoJSON['centre'];
            this._settings.zoom = geoJSON['zoom'];
        }

        if (this._settings && !this._settings.version) {
            this._settings.version = MapContainer._version;;
        }

        if (this._settings.centre) {
            this._map.setView([this._settings.centre.lat, this._settings.centre.lng], this._settings.zoom);
        } else {
            this.setDefaultView();
        }

        return true;
    }

    private saveMap = () => {
        this._fileManager.saveMap(this._settings, this._layers);
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
