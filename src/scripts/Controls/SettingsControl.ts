import * as L from 'leaflet';
import { Settings } from '../../Settings';
import { EventTopics } from '../EventTopics';
import { IMapLayer } from '../layers/IMapLayer';

export class SettingsControl {
    private static inputDivClasses = ['form-check', 'form-switch'];
    private static checkboxClasses = ['form-check-input', 'appearance-none', 'w-9', '-ml-10',
        'rounded-full', 'float-left', 'h-5', 'align-top', 'bg-white', 'bg-no-repeat', 'bg-contain',
        'bg-gray-300', 'focus:outline-none', 'cursor-pointer', 'shadow-sm'];
    private static labelClasses = ['form-check-label', 'inline-block', 'text-gray-800'];
    private static buttonClasses = ['inline-block', 'px-6', 'py-2.5', 'bg-blue-600', 'text-gray', 'font-medium', 'text-xs', 'leading-tight', 'uppercase', 'rounded', 'shadow-md', 'hover:bg-blue-700', 'hover:shadow-lg', 'hover:text-white', 'focus:bg-blue-700', 'focus:shadow-lg', 'focus:outline-none', 'focus:ring-0', 'active:bg-blue-800', 'active:shadow-lg', 'transition', 'duration-150', 'ease-in-out'];

    static getAction = (): L.Toolbar2.Action => {
        const settingsAction = L.Toolbar2.Action.extend({
            options: {
                toolbarIcon: {
                    html: '<div class="settings-button"></div>',
                    tooltip: 'Change map settings'
                }
            },

            addHooks: function () {
                PubSub.publish(EventTopics.showSettings);
            }
        });

        return settingsAction;
    }

    static create = (settings: Settings, layers: Map<string, IMapLayer>): L.Control => {
        const settingsBox = new L.Control({ position: "bottomleft" });

        const div = document.createElement('div');
        div.classList.add('settings');

        const header = document.createElement('h4');
        header.textContent = 'Settings';

        div.appendChild(header);

        div.appendChild(SettingsControl.createTitle(settings.title));

        div.appendChild(SettingsControl.createReadOnly(settings.readOnly));

        const layerSettings = SettingsControl.createLayers(layers, settings);
        div.appendChild(layerSettings);

        const buttons = SettingsControl.createButtons();
        div.appendChild(buttons);

        settingsBox.onAdd = (map) => {
            return div;
        };

        return settingsBox;
    }

    private static createTitle = (title: string): HTMLElement => {
        const element = document.createElement('div');

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
        div.classList.add('toggle');
        div.classList.add('flex');
        div.classList.add('justify-left');

        const element = document.createElement('div');
        SettingsControl.inputDivClasses.forEach(className => {
            element.classList.add(className);
        });

        const input = document.createElement('input');
        input.id = 'read-only';
        SettingsControl.checkboxClasses.forEach(className => {
            input.classList.add(className);
        });
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
        div.classList.add('toggle');
        div.classList.add('flex');
        div.classList.add('justify-left');

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
        SettingsControl.checkboxClasses.forEach(className => {
            input.classList.add(className);
        });
        input.type = 'checkbox';
        input.checked = selected;
        input.disabled = disabled;
        element.appendChild(input);

        div.appendChild(element);

        return div
    }

    private static createButtons = (): HTMLElement => {
        const element = document.createElement('div');

        const saveButton = document.createElement('button');
        saveButton.type = 'button';
        saveButton.textContent = 'Save';
        SettingsControl.buttonClasses.forEach(className => {
            saveButton.classList.add(className);
        });

        saveButton.addEventListener('click', (event) => {
            const settings = new Settings();

            settings.title = (<HTMLInputElement>document.getElementById('title'))?.value;
            settings.readOnly = (<HTMLInputElement>document.getElementById('read-only'))?.checked;

            const layers = document.getElementsByName('layer');
            const array = Array.from(layers);
            const selectedLayers = new Array<string>();

            array.forEach(layerElement => {
                if ((<HTMLInputElement>layerElement).checked) {
                    selectedLayers.push(layerElement.id);
                }
            });

            settings.activeLayers = selectedLayers;

            PubSub.publish(EventTopics.saveSettings, settings);
        });

        element.appendChild(saveButton);

        const cancelButton = document.createElement('button');
        cancelButton.type = 'button';
        cancelButton.textContent = 'Cancel';
        SettingsControl.buttonClasses.forEach(className => {
            cancelButton.classList.add(className);
        });

        cancelButton.addEventListener('click', (event) => {
            PubSub.publish(EventTopics.showSettings);
        });

        element.appendChild(cancelButton);

        return element;
    }
}
