import * as L from 'leaflet';
import { EventTopics } from '../EventTopics';

export class SharingControl {
    private static rowMargin = 'mb-2';
    private static inputDivClasses = ['form-check', 'form-switch'];
    private static checkboxClasses = ['form-check-input', 'appearance-none', 'w-9', '-ml-10',
        'rounded-full', 'float-left', 'h-5', 'align-top', 'bg-white', 'bg-no-repeat', 'bg-contain',
        'bg-gray-300', 'focus:outline-none', 'cursor-pointer', 'shadow-sm'];
    private static labelClasses = ['form-check-label', 'inline-block', 'text-gray-800'];
    private static buttonClasses = ['inline-block', 'px-6', 'py-2.5', 'bg-blue-600', 'text-white', 'font-medium', 'text-xs', 'leading-tight', 'uppercase', 'rounded', 'shadow-md', 'hover:bg-blue-700', 'hover:shadow-lg', 'hover:text-white', 'focus:bg-blue-700', 'focus:shadow-lg', 'focus:outline-none', 'focus:ring-0', 'active:bg-blue-800', 'active:shadow-lg', 'transition', 'duration-150', 'ease-in-out'];

    static getAction = (): L.Toolbar2.Action => {
        const settingsAction = L.Toolbar2.Action.extend({
            options: {
                toolbarIcon: {
                    html: '<div class="share-button"></div>',
                    tooltip: 'Share this map'
                }
            },

            addHooks: function () {
                PubSub.publish(EventTopics.showSharingPopup);
            }
        });

        return settingsAction;
    }

    static create = (hash: string, title: string): L.Control => {
        const sharingBox = new L.Control({ position: "bottomleft" });

        const form = document.createElement('form');
        form.id = 'sharing';
        form.classList.add('popup');

        form.addEventListener('submit', (event) => {
            event.preventDefault();

            const width = Number.parseInt((<HTMLInputElement>document.getElementById('width'))?.value);
            const height = Number.parseInt((<HTMLInputElement>document.getElementById('height'))?.value);
            const hideToolbar = (<HTMLInputElement>document.getElementById('hide-toolbar'))?.checked;

            SharingControl.CreateHtml(width, height, hideToolbar, hash, title);

            const messageRow = document.getElementById('messageRow');
            if (messageRow !== null) {
                messageRow.style.display = 'block';
            }

            return false;
        });

        const header = document.createElement('h4');
        header.textContent = 'Share map';

        form.appendChild(header);

        form.appendChild(SharingControl.createWidth());

        form.appendChild(SharingControl.createHeight());

        form.appendChild(SharingControl.createHideToolbar());

        form.appendChild(SharingControl.createMessageRow());

        form.appendChild(SharingControl.createButtons(hash, title));

        sharingBox.onAdd = (map) => {
            return form;
        };

        return sharingBox;
    }

    private static createWidth = (): HTMLElement => {
        const element = document.createElement('div');
        element.classList.add(SharingControl.rowMargin);

        const widthLabel = document.createElement('label');
        widthLabel.textContent = 'Width';
        widthLabel.setAttribute('for', 'width');
        element.appendChild(widthLabel);

        const widthInput = document.createElement('input');
        widthInput.id = 'width';
        widthInput.type = 'number';
        widthInput.required = true;
        widthInput.classList.add('border-solid');
        element.appendChild(widthInput);

        let pxSpan = document.createElement('span');
        pxSpan.textContent = 'px';
        element.appendChild(pxSpan);

        return element
    }

    private static createHeight = (): HTMLElement => {
        const element = document.createElement('div');
        element.classList.add(SharingControl.rowMargin);

        const heightLabel = document.createElement('label');
        heightLabel.textContent = 'Height';
        heightLabel.setAttribute('for', 'height');
        element.appendChild(heightLabel);

        const heightInput = document.createElement('input');
        heightInput.id = 'height';
        heightInput.type = 'number';
        heightInput.required = true;
        heightInput.classList.add('border-solid');
        element.appendChild(heightInput);

        const pxSpan = document.createElement('span');
        pxSpan.textContent = 'px';
        element.appendChild(pxSpan);

        return element
    }

    private static createHideToolbar = (): HTMLElement => {
        const div = document.createElement('div');
        div.classList.add('toggle');
        div.classList.add('flex');
        div.classList.add('justify-left');
        div.classList.add(SharingControl.rowMargin);

        const element = document.createElement('div');
        SharingControl.inputDivClasses.forEach(className => {
            element.classList.add(className);
        });

        const input = document.createElement('input');
        input.id = 'hide-toolbar';
        SharingControl.checkboxClasses.forEach(className => {
            input.classList.add(className);
        });
        input.type = 'checkbox';
        input.setAttribute('role', 'switch');
        element.appendChild(input);

        const label = document.createElement('label');
        label.textContent = 'Hide toolbar';
        label.setAttribute('for', 'hide-toolbar');
        SharingControl.labelClasses.forEach(className => {
            label.classList.add(className);
        });
        element.appendChild(label);

        div.appendChild(element);

        return div
    }

    private static createButtons = (hash: string, title: string): HTMLElement => {
        const element = document.createElement('div');
        element.classList.add('flex');
        element.classList.add('justify-center');
        element.classList.add(SharingControl.rowMargin);

        const saveButton = document.createElement('button');
        saveButton.type = 'submit';
        saveButton.textContent = 'Create';
        SharingControl.buttonClasses.forEach(className => {
            saveButton.classList.add(className);
        });

        element.appendChild(saveButton);

        const cancelButton = document.createElement('button');
        cancelButton.type = 'button';
        cancelButton.textContent = 'Close';
        SharingControl.buttonClasses.forEach(className => {
            cancelButton.classList.add(className);
        });

        cancelButton.addEventListener('click', (event: MouseEvent) => {
            PubSub.publish(EventTopics.showSharingPopup);
        });

        element.appendChild(cancelButton);

        return element;
    }

    private static createMessageRow() {
        const div = document.createElement('div');
        div.id = 'messageRow';
        div.textContent = 'Copied to clipboard';
        div.style.display = 'none';

        return div;
    }

    private static CreateHtml(width: number, height: number, hideToolbar: boolean, hash: string, title: string) {
        const origin = window.location.origin;
        const html = `<iframe src="${origin}?hide-toolbar=${hideToolbar}#${hash}" width="${width}" height="${height}" title="title"></iframe>`;

        if (!navigator.clipboard) {
            // Clipboard API not available
            return
        }

        navigator.clipboard.writeText(html)
            .then(() => {
                console.log("Text copied to clipboard...")
            })
            .catch(err => {
                console.log('Something went wrong', err);
            })
    }
}
