import * as L from 'leaflet';
import { Settings } from '../../Settings';
import { EventTopics } from '../EventTopics';
import { IMapLayer } from '../layers/IMapLayer';
import { IModalWindow } from './IModalWindow';
import { ToolbarButton } from './ToolbarButton';
import { FileManager } from '../FileManager';
import '../../styles/mapmanager.css'

export class MapManagerControl implements IModalWindow {
    public static Id: string = 'MapManager';
    public id: string = MapManagerControl.Id;
    public selected: boolean = false;

    private _fileManager: FileManager;
    private _mapManagerBox: L.Control;
    private _layers: Map<string, IMapLayer>;
    private _settings: Settings;

    private static _prefix: string = 'map-manager';
    private static rowMargin = 'mb-2';

    constructor(fileManager: FileManager) {
        this._fileManager = fileManager;
        this._mapManagerBox = new L.Control({ position: "bottomleft" });
        this._mapManagerBox.onAdd = (map) => {
            return this.create();
        };
    }

    getToolbarButton = (): ToolbarButton => {
        const button = new ToolbarButton();
        {
            button.id = MapManagerControl._prefix;
            button.tooltip = 'Save, load, and export maps';
            button.groupName = '';
            button.action = this.onButtonClick;
            button.selected = this.selected;
        };

        return button;
    }

    getControl = (): L.Control => {
        return this._mapManagerBox;
    }

    update = (settings: Settings, layers: Map<string, IMapLayer>) => {
        this._layers = layers;
        this._settings = settings;
    }

    private onButtonClick = (e: Event, map: L.Map) => {
        if (this.selected) {
            PubSub.publish(EventTopics.hideModalWindows, null);
            this.selected = false;
            return;
        }

        this.selected = true;
        PubSub.publish(EventTopics.showMapManager, this);
    }

    private create = (): HTMLElement => {
        const div = document.createElement('div');
        div.classList.add('modal');
        div.id = MapManagerControl._prefix;

        const header = document.createElement('h4');
        header.textContent = 'Manage maps';

        div.appendChild(header);

        div.appendChild(MapManagerControl.createFileButtons());

        div.append(this.createNewMapSection());

        const layerSettings = this.createLocalStorageMapList();
        if (layerSettings !== null) {
            div.appendChild(layerSettings);
        }

        const buttons = MapManagerControl.createButtons();
        div.appendChild(buttons);

        return div;
    }

    private static createFileButtons = (): HTMLElement => {
        const element = document.createElement('div');
        element.classList.add(MapManagerControl.rowMargin);

        const newMapButton = document.createElement('input');
        newMapButton.type = 'button';
        newMapButton.id = 'new-map';
        newMapButton.setAttribute('title', 'Create a new map');
        newMapButton.addEventListener('click', (event: Event) => {
            event.stopPropagation();
            document.getElementById('create-new-map')?.classList.remove('hidden');
            const title = (<HTMLInputElement>document.getElementById('new-map-title'))?.focus();
        });
        element.appendChild(newMapButton);

        const openFileButton = document.createElement('input');
        openFileButton.type = 'button';
        openFileButton.id = 'load-file';
        openFileButton.setAttribute('title', 'Load a map from a JSON file');
        openFileButton.addEventListener('click', (event: Event) => {
            event.stopPropagation();
            PubSub.publish(EventTopics.loadMapFromFile);
        });
        element.appendChild(openFileButton);

        const saveFileButton = document.createElement('input');
        saveFileButton.type = 'button';
        saveFileButton.id = 'save-file';
        saveFileButton.setAttribute('title', 'Save a map to a JSON file');
        saveFileButton.addEventListener('click', (event: Event) => {
            event.stopPropagation();
            PubSub.publish(EventTopics.saveMapToFile);
        });
        element.appendChild(saveFileButton);

        const exportFileButton = document.createElement('input');
        exportFileButton.type = 'button';
        exportFileButton.id = 'save-geojson-file';
        exportFileButton.setAttribute('title', 'Export a map to GeoJSON');
        exportFileButton.addEventListener('click', (event: Event) => {
            event.stopPropagation();
            PubSub.publish(EventTopics.saveMapToGeoJSONFile);
        });
        element.appendChild(exportFileButton);

        return element
    }

    private createNewMapSection = () => {
        const section = document.createElement('div');
        section.id = 'create-new-map';
        section.classList.add('hidden');

        const titleRow = document.createElement('div');
        titleRow.classList.add(MapManagerControl.rowMargin);

        const label = document.createElement('label');
        label.textContent = 'Title';
        label.setAttribute('for', 'title');
        titleRow.appendChild(label);

        const input = document.createElement('input');
        input.id = 'new-map-title';
        input.type = 'text';
        input.value = '';
        input.classList.add('border-solid');
        titleRow.appendChild(input);

        section.appendChild(titleRow);

        const duplicateTitleRow = document.createElement('div');
        const message = document.createElement('span');
        message.id = 'duplicate-title-error';
        message.classList.add('text-red-700', 'hidden');
        duplicateTitleRow.appendChild(message);
        section.appendChild(duplicateTitleRow);

        const buttonRow = document.createElement('div');
        buttonRow.classList.add('flex');
        buttonRow.classList.add('justify-center');
        buttonRow.classList.add(MapManagerControl.rowMargin);

        const createButton = document.createElement('button');
        createButton.type = 'button';
        createButton.textContent = 'Create';

        createButton.addEventListener('click', (event) => {
            const settings = new Settings();

            const title = (<HTMLInputElement>document.getElementById('new-map-title'))?.value;
            const existingMapTitle = this._fileManager.loadMapListFromStorage();

            if (existingMapTitle.includes(title)) {
                message.textContent = `You already have a map named ${title}`;
                message.classList.remove('hidden');
                return;
            }

            message.classList.remove('hidden');

            settings.title = title;
            settings.readOnly = false;

            const layers = new Array<string>();
            this._layers.forEach((layer, layerName) => {
                layers.push(layerName);
            });

            settings.activeLayers = layers;

            PubSub.publish(EventTopics.createNewMap, settings);
        });

        buttonRow.appendChild(createButton);

        section.appendChild(buttonRow);

        return section
    }

    private createLocalStorageMapList = (): HTMLElement | null => {
        const mapNames = this._fileManager.loadMapListFromStorage();

        if (mapNames.length > 0) {
            const section = document.createElement('div');
            section.id = 'map-list';
            section.classList.add(MapManagerControl.rowMargin);

            const header = document.createElement('h4');
            header.textContent = 'Maps stored in your browser';

            section.appendChild(header);

            const instruction = document.createElement('div');;
            instruction.classList.add('italic', 'text-center', MapManagerControl.rowMargin);
            instruction.textContent = 'Click map name to load that map';
            section.appendChild(instruction);

            const list = document.createElement('ul');
            mapNames.forEach((mapName) => {
                const isCurrentMap = mapName === this._settings.title;
                list.appendChild(this.createMapListItem(mapName, isCurrentMap));
            });

            section.appendChild(list);
            return section;
        }

        return null;
    }

    private createMapListItem = (mapName: string, isCurrentMap: boolean): HTMLElement => {
        const listElement = document.createElement('li');
        listElement.classList.add('local-map');
        const label = document.createElement('span');

        if (isCurrentMap) {
            mapName = `${mapName} (current map)`;
            label.classList.add('font-bold');
        } else {
            label.classList.add('cursor-pointer');
            label.addEventListener('click', (event: Event) => {
                event.stopPropagation();
                const mapData = this._fileManager.loadMapFromStorage(mapName);
                PubSub.publish(EventTopics.fileLoaded, mapData);
            });

            const deleteButton = document.createElement('input');
            deleteButton.classList.add('delete-button', 'float-right');
            deleteButton.type = 'button';
            deleteButton.addEventListener('click', (event: Event) => {
                event.stopPropagation();
                this._fileManager.deleteMapFromStorage(mapName);

                const mapListElement = document.getElementById('map-list');
                if (mapListElement) {
                    const newMapListElement = <Node>this.createLocalStorageMapList();
                    mapListElement.replaceWith(newMapListElement);
                }
            });

            listElement.appendChild(deleteButton);
        }

        label.textContent = mapName;
        listElement.appendChild(label);

        return listElement;
    }

    private static createButtons = (): HTMLElement => {
        const element = document.createElement('div');
        element.classList.add('flex');
        element.classList.add('justify-center');
        element.classList.add(MapManagerControl.rowMargin);

        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.textContent = 'Close';

        closeButton.addEventListener('click', (event) => {
            PubSub.publish(EventTopics.hideModalWindows, null);
        });

        element.appendChild(closeButton);

        return element;
    }
}
