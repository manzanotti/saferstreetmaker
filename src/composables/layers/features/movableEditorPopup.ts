import type * as L from 'leaflet';
import { makeMovablePanel, type MovablePanelController } from '../../../directives/movablePanel';

export function makeEditorPopupMovable(popup: L.Popup, map: L.Map): L.Popup {
    let drag: MovablePanelController | undefined;
    const mapEvents = 'moveend zoomend resize';

    popup.on('add', () => {
        const element = popup.getElement();
        if (!element) {
            return;
        }
        element.classList.add('movable-editor-popup');
        // Leaflet owns transform for map anchoring and zoom animations.
        drag = makeMovablePanel(element, {
            offsetProperty: 'translate',
            constrainOnWindowResize: false
        });
        map.on(mapEvents, drag.constrain);
    });
    popup.on('remove', () => {
        if (drag) {
            map.off(mapEvents, drag.constrain);
            drag.dispose();
            drag = undefined;
        }
        popup.getElement()?.classList.remove('movable-editor-popup');
    });

    return popup;
}
