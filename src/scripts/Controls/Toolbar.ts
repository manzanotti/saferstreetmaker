import * as L from 'leaflet';
import { Settings } from '../../Settings';
import { IMapLayer } from '../layers/IMapLayer';
import { IModalWindow } from './IModalWindow';
import { ToolbarButton } from './ToolbarButton';

export class Toolbar {
    static createToolbarControl = (layers: Map<string, IMapLayer>, settings: Settings, modalWindows: Array<IModalWindow>, otherButtons: Array<ToolbarButton>): L.Control => {
        const position = settings.readOnly ? 'bottomleft' : 'topleft';
        const toolbarControl = new L.Control({ position: position });

        toolbarControl.onAdd = (map: L.Map) => {
            return Toolbar.generateToolbar(layers, settings, modalWindows, map, otherButtons);
        };
        return toolbarControl;
    }

    private static generateToolbar = (layers: Map<string, IMapLayer>, settings: Settings, modalWindows: Array<IModalWindow>, map: L.Map, otherButtons: Array<ToolbarButton>): HTMLElement => {
        const buttons = Toolbar.getButtons(layers, settings, modalWindows, otherButtons);

        const toolbarElement = document.createElement('ul');
        toolbarElement.classList.add('toolbar');

        const toolbarButtons = Toolbar.generateToolbarButtons(buttons, map);

        toolbarElement.append(...toolbarButtons);
        return toolbarElement;
    }

    private static getButtons = (layers: Map<string, IMapLayer>, settings: Settings, modalWindows: Array<IModalWindow>, otherButtons: Array<ToolbarButton>): Array<ToolbarButton> => {
        const buttons = new Array<ToolbarButton>();

        if (!settings.readOnly) {
            layers.forEach((layer, layerName) => {
                if (settings.activeLayers.includes(layerName)) {
                    const button = layer.getToolbarButton();
                    buttons.push(button);
                }
            });

            const groupButtonsToRemove = new Array<ToolbarButton>();
            buttons.forEach((button) => {
                if (button.groupName) {
                    let parentButton: ToolbarButton | null = null;
                    const selectedGroupButtons = buttons.filter((b) => b.groupName === button.groupName && b.selected);
                    if (selectedGroupButtons.length > 0) {
                        parentButton = selectedGroupButtons[0];
                    } else {
                        const groupButtons = buttons.filter((b) => b.groupName === button.groupName && b.isFirst);
                        if (groupButtons.length > 0) {
                            parentButton = groupButtons[0];
                        }
                    }

                    if (parentButton !== null) {
                        if (!parentButton.buttons) {
                            parentButton.buttons = new Array<ToolbarButton>();
                        }

                        if (parentButton.id !== button.id) {
                            groupButtonsToRemove.push(button);
                            parentButton.buttons.push(button);
                        }
                    }
                }
            });

            if (groupButtonsToRemove.length > 0) {
                groupButtonsToRemove.forEach((button) => {
                    const index = buttons.indexOf(button);
                    buttons.splice(index, 1);
                });
            }
        }

        modalWindows.forEach((modalWindow) => {
            buttons.push(modalWindow.getToolbarButton());
        });

        buttons.push(...otherButtons);

        return buttons;
    }

    private static generateToolbarButtons = (buttons: Array<ToolbarButton>, map: L.Map): Array<Node> => {
        const toolbarButtons = new Array<HTMLElement>();

        buttons.forEach((button) => {
            const buttonContainer = document.createElement('li');

            const buttonElement = Toolbar.createButtonElement(button, map);

            buttonContainer.appendChild(buttonElement);

            if (button.buttons && button.buttons.length > 0) {
                buttonContainer.classList.add('group');
                const subToolbar = document.createElement('ul');
                subToolbar.classList.add('hidden', 'subToolbar');

                button.buttons.forEach((b) => {
                    const container = document.createElement('li');
                    container.appendChild(Toolbar.createButtonElement(b, map));
                    subToolbar.appendChild(container);
                });

                buttonElement.addEventListener('contextmenu', (event: Event) => {
                    L.DomEvent.preventDefault(event);
                    subToolbar.classList.remove('hidden');
                });

                Toolbar.onLongPress(buttonElement, (event: Event) => {
                    L.DomEvent.preventDefault(event);
                    subToolbar.classList.remove('hidden');
                })

                buttonContainer.appendChild(subToolbar);

                const indicator = document.createElement('span');
                buttonContainer.appendChild(indicator);
            }

            toolbarButtons.push(buttonContainer);
        });

        return toolbarButtons;
    }

    private static createButtonElement = (button: ToolbarButton, map: L.Map) => {
        const buttonElement = document.createElement('input');
        buttonElement.setAttribute('id', `${button.id}-button`);
        buttonElement.setAttribute('type', 'button');
        buttonElement.classList.add('toolbar-button', `${button.id}`);
        buttonElement.setAttribute('title', button.tooltip);

        if (button.text) {
            buttonElement.setAttribute('value', button.text);
        }

        if (button.selected) {
            buttonElement.classList.add('selected');
        }

        buttonElement.addEventListener('click', (event: Event) => {
            L.DomEvent.disableClickPropagation(buttonElement);
            button.action(event, map);
        });

        return buttonElement;
    }

    private static onLongPress = (element: HTMLElement, callback: Function) => {
        let timer: number | undefined;

        element.addEventListener('touchstart', () => {
            timer = setTimeout(() => {
                timer = undefined;
                callback();
            }, 500);
        });

        function cancel() {
            clearTimeout(timer);
        }

        element.addEventListener('touchend', cancel);
        element.addEventListener('touchmove', cancel);
    }
}
