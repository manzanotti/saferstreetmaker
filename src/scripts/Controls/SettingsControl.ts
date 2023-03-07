import * as L from 'leaflet';
import { Settings } from '../../Settings';
import { EventTopics } from '../EventTopics';
import { IMapLayer } from '../layers/IMapLayer';
import { IModalWindow } from './IModalWindow';
import { ToolbarButton } from './ToolbarButton';

export class SettingsControl implements IModalWindow {
    public static Id: string = 'Settings';
    public id: string = SettingsControl.Id;
    public selected: boolean = false;

    private _settingsBox: L.Control;
    private _settings: Settings;
    private _layers: Map<string, IMapLayer>;

    private static _prefix: string = 'settings';
    private static rowMargin = 'mb-2';
    private static inputDivClasses = ['form-check', 'form-switch'];

    private static labelClasses = ['form-check-label', 'inline-block', 'text-gray-800'];

    constructor() {
        this._settingsBox = new L.Control({ position: "bottomleft" });
        this._settingsBox.onAdd = (map) => {
            return this.create(this._settings, this._layers);
        };
    }

    getToolbarButton = (): ToolbarButton => {
        const button = new ToolbarButton();
        {
            button.id = SettingsControl._prefix;
            button.tooltip = 'Change map settings';
            button.groupName = '';
            button.action = this.onButtonClick;
            button.selected = this.selected;
        };

        return button;
    }

    getControl = (): L.Control => {
        return this._settingsBox;
    }

    update = (settings: Settings, layers: Map<string, IMapLayer>) => {
        this._settings = settings;
        this._layers = layers;
    }

    private onButtonClick = (e: Event, map: L.Map) => {
        if (this.selected) {
            PubSub.publish(EventTopics.hideModalWindows, null);
            this.selected = false;
            return;
        }

        this.selected = true;
        PubSub.publish(EventTopics.showSettings, this);
    }

    create = (settings: Settings, layers: Map<string, IMapLayer>): HTMLElement => {
        const div = document.createElement('div');
        div.classList.add('modal');

        const header = document.createElement('h4');
        header.textContent = 'Settings';

        div.appendChild(header);

        div.appendChild(SettingsControl.createTitle(settings.title));

        div.appendChild(SettingsControl.createReadOnly(settings.readOnly));

        const layerSettings = SettingsControl.createLayers(layers, settings);
        div.appendChild(layerSettings);

        const buttons = this.createButtons();
        div.appendChild(buttons);

        return div;
    }

    private static createTitle = (title: string): HTMLElement => {
        const element = document.createElement('div');
        element.classList.add(SettingsControl.rowMargin);

        const label = document.createElement('label');
        label.textContent = 'Title';
        label.setAttribute('for', 'title');
        element.appendChild(label);

        const input = document.createElement('input');
        input.id = 'title';
        input.type = 'text';
        input.value = title;
        input.classList.add('border-solid');
        element.appendChild(input);

        return element
    }

    private static createReadOnly = (readOnly: boolean): HTMLElement => {
        const div = document.createElement('div');
        div.classList.add('toggle', 'flex', 'justify-left');
        div.classList.add(SettingsControl.rowMargin);

        const element = document.createElement('div');
        SettingsControl.inputDivClasses.forEach(className => {
            element.classList.add(className);
        });

        const input = document.createElement('input');
        input.id = 'read-only';
        input.type = 'checkbox';
        input.checked = readOnly;
        input.setAttribute('role', 'switch');
        element.appendChild(input);

        const label = document.createElement('label');
        label.textContent = 'Read-only';
        label.setAttribute('for', 'read-only');
        SettingsControl.labelClasses.forEach(className => {
            label.classList.add(className);
        });
        element.appendChild(label);

        div.appendChild(element);

        return div
    }

    private static createLayers = (layers: Map<string, IMapLayer>, settings: Settings): HTMLElement => {
        const section = document.createElement('div');
        section.classList.add(SettingsControl.rowMargin);

        const header = document.createElement('h4');
        header.textContent = 'Visible Layers';

        section.appendChild(header);

        layers.forEach(layer => {
            const id = layer.id;
            const selected = settings.activeLayers.includes(id);

            section.appendChild(SettingsControl.createLayer(layer.title, id, selected, settings.readOnly));
        });

        return section;
    }

    private static createLayer = (title: string, id: string, selected: boolean, disabled: boolean): HTMLElement => {
        const div = document.createElement('div');
        div.classList.add('toggle', 'flex', 'justify-left');
        div.classList.add(SettingsControl.rowMargin);

        const element = document.createElement('div');
        SettingsControl.inputDivClasses.forEach(className => {
            element.classList.add(className);
        });

        const label = document.createElement('label');
        label.textContent = title;
        label.setAttribute('for', id);
        element.appendChild(label);

        const input = document.createElement('input');
        input.id = id;
        input.name = 'layer';
        input.type = 'checkbox';
        input.role = 'switch';
        input.checked = selected;
        input.disabled = disabled;
        element.appendChild(input);

        div.appendChild(element);

        return div
    }

    private createButtons = (): HTMLElement => {
        const element = document.createElement('div');
        element.classList.add('flex', 'justify-center');
        element.classList.add(SettingsControl.rowMargin);

        const saveButton = document.createElement('button');
        saveButton.type = 'button';
        saveButton.textContent = 'Save';

        saveButton.addEventListener('click', (event) => {
            const settings = new Settings();

            settings.title = (<HTMLInputElement>document.getElementById('title'))?.value;
            settings.readOnly = (<HTMLInputElement>document.getElementById('read-only'))?.checked;

            const layers = document.getElementsByName('layer');
            const array = Array.from(layers);
            const selectedLayers = new Array<string>();

            array.forEach(layerElement => {
                if ((<HTMLInputElement>layerElement).checked) {
                    const layerId = layerElement.id;
                    selectedLayers.push(layerId);
                }
            });

            settings.activeLayers = selectedLayers;

            PubSub.publish(EventTopics.saveSettings, settings);
        });

        element.appendChild(saveButton);

        const cancelButton = document.createElement('button');
        cancelButton.type = 'button';
        cancelButton.textContent = 'Cancel';

        cancelButton.addEventListener('click', (event) => {
            PubSub.publish(EventTopics.hideModalWindows, null);
        });

        element.appendChild(cancelButton);

        return element;
    }
}
