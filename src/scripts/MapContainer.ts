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

export class MapContainer {
    private _fileManager: FileManager;
    private _map: L.Map;
    private _title: string;
    private _layers: Map<string, IMapLayer>;

    constructor(fileManager: FileManager) {
        this._fileManager = fileManager;

        this._map = new L.Map('map');
        this._title = 'Hello Cleveland';

        this._layers = new Map<string, IMapLayer>;

        this.setupMap();

        this.addLayers();

        this.addOverlay(this._layers);
        this.addLegend(this._layers);
        this.addToolbar(this._layers);
        
        this.setupMapEventHandlers();
        this.setupSubscribers();
    }

    private setupMap = () => {
        const tileLayer = new L.TileLayer('https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 20
        });
        this._map.addLayer(tileLayer);
    };

    private addLayers = () => {
        this._layers.set(ModalFilterLayer.Id, new ModalFilterLayer());
        this._layers.set(MobilityLaneLayer.Id, new MobilityLaneLayer());
        this._layers.set(TramLineLayer.Id, new TramLineLayer());
        this._layers.set(CarFreeStreetLayer.Id, new CarFreeStreetLayer());
        this._layers.set(SchoolStreetLayer.Id, new SchoolStreetLayer());
        this._layers.set(OneWayStreetLayer.Id, new OneWayStreetLayer());

        this._layers.forEach((layer, key) => {
            this._map.addLayer(layer.getLayer());
        });
    };

    private addToolbar = (layers: Map<string, IMapLayer>) => {
        const toolbar = Toolbar.create(this._map, layers);
        this._map.addControl(toolbar);
    }

    private addOverlay = (layers: Map<string, IMapLayer>) => {
        const overlays = {};
        layers.forEach((layer, key) => {
            overlays[layer.title] = layer.getLayer();
        });

        const overlay = new L.Control.Layers(undefined, overlays, { collapsed: false, position: 'bottomright' });
        this._map.addControl(overlay);
    };

    private addLegend = (layers: Map<string, IMapLayer>) => {
        const legend = Legend.create(layers);
        this._map.addControl(legend);
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
            this._layers.forEach((layer, layerName) => {
                layer.getLayer().clearLayers();
            });
            if (this.loadMapData(data)) {
                this.saveMap();
            };
        });

        PubSub.subscribe(EventTopics.layerUpdated, (msg, data) => {
            this.saveMap();
        });

        PubSub.subscribe(EventTopics.showPopup, (msg, popup) => {
            this._map.openPopup(popup);
        });

        PubSub.subscribe(EventTopics.closePopup, (msg, popup) => {
            this._map.closePopup(popup);
        });

        PubSub.subscribe(EventTopics.saveMapToFile, (msg, popup) => {
            const centre = this._map.getCenter();
            const zoom = this._map.getZoom();

            this._fileManager.saveMapToFile(this._title, this._layers, centre, zoom);
        });

        PubSub.subscribe(EventTopics.saveMapToGeoJSONFile, (msg, popup) => {
            this._fileManager.saveMapToGeoJSONFile(this._title, this._layers);
        });

        PubSub.subscribe(EventTopics.loadMapFromFile, (msg, popup) => {
            this._fileManager.loadMapFromFile();
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
        if (remoteMapFile) {
            const mapData = await this._fileManager.loadMapFromRemoteFile(remoteMapFile);
            return this.loadMapData(mapData);
        }
        const lastMapSelected = this._fileManager.loadLastMapSelected();
        const geoJSON = this._fileManager.loadMapFromStorage(lastMapSelected || this._title);

        return this.loadMapData(geoJSON);
    };

    private loadMapData = (geoJSON): boolean => {
        if (geoJSON === null) {
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
                } else if (layerName === MobilityLaneLayer.Id && layersJSON['CycleLanes'] !== undefined) {
                    layerName = 'CycleLanes';
                }
                const layerJSON = layersJSON[layerName];
                layer.loadFromGeoJSON(layerJSON);
            });
        }

        return true;
    }

    private saveMap = () => {
        const centre = this._map.getCenter();
        const zoom = this._map.getZoom();

        this._fileManager.saveMap(this._title, this._layers, centre, zoom);
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
