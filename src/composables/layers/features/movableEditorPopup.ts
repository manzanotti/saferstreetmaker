import type * as L from 'leaflet';
import { makeMovablePanel } from '../../../directives/movablePanel';

export function makeEditorPopupMovable(popup: L.Popup): L.Popup {
    let disposeDrag: (() => void) | undefined;

    popup.on('add', () => {
        const element = popup.getElement();
        if (!element) {
            return;
        }
        element.classList.add('movable-editor-popup');
        // Leaflet owns transform for map anchoring and zoom animations.
        disposeDrag = makeMovablePanel(element, 'translate');
    });
    popup.on('remove', () => {
        disposeDrag?.();
        disposeDrag = undefined;
        popup.getElement()?.classList.remove('movable-editor-popup');
    });

    return popup;
}
