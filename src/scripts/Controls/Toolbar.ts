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

                    if (button.groupName) {
                        let groupButtons = buttons.filter((b) => b.groupName === button.groupName);

                        if (groupButtons.length > 0) {
                            const groupButton = groupButtons[0];
                            if (button.selected) {
                                const index = buttons.indexOf(groupButton);
                                button.buttons = new Array<ToolbarButton>();
                                button.buttons.push(groupButton);
                                buttons.splice(index, 1, button);
                            } else {
                                groupButton.buttons.push(button);
                            }
                        } else {
                            button.buttons = new Array<ToolbarButton>();
                            buttons.push(button);
                        }
                    } else {
                        buttons.push(button);
                    }
                }
            });
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

            if (button.buttons) {
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
            }

            toolbarButtons.push(buttonContainer);
        });

        return toolbarButtons;
    }

    private static createButtonElement = (button: ToolbarButton, map: L.Map) => {
        const buttonElement = document.createElement('input');
        buttonElement.setAttribute('id', `${button.id}-button`);
        buttonElement.setAttribute('type', 'button');
        buttonElement.classList.add('toolbar-button');
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
