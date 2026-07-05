import * as L from 'leaflet';
import { createApp, type Component } from 'vue';
import { pinia } from '../stores/index';

/**
 * Creates a Leaflet control that mounts a Vue component inside it.
 * All mounted components share the app-wide Pinia instance so they
 * can read/write the same stores as App.vue.
 *
 * Click and scroll propagation to the Leaflet map is disabled on the
 * container element so interactions with the control are not accidentally
 * forwarded to the map.
 */
export function makeLeafletVueControl(
    Component: Component,
    position: L.ControlPosition = 'topleft'
): L.Control {
    const control = new L.Control({ position });
    let container: HTMLElement | null = null;
    let pointerDownHandler: ((event: PointerEvent) => void) | null = null;
    let controlDblClickHandler: ((event: MouseEvent) => void) | null = null;
    let documentDblClickHandler: ((event: MouseEvent) => void) | null = null;
    let clearGuardTimer: ReturnType<typeof setTimeout> | null = null;

    control.onAdd = (): HTMLElement => {
        container = L.DomUtil.create('div');
        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);

        let swallowNextDblClick = false;

        const disarmGuard = () => {
            swallowNextDblClick = false;
            if (clearGuardTimer !== null) {
                clearTimeout(clearGuardTimer);
                clearGuardTimer = null;
            }
        };

        const armGuard = () => {
            swallowNextDblClick = true;
            if (clearGuardTimer !== null) {
                clearTimeout(clearGuardTimer);
            }
            clearGuardTimer = setTimeout(() => {
                swallowNextDblClick = false;
                clearGuardTimer = null;
            }, 350);
        };

        pointerDownHandler = () => {
            armGuard();
        };
        container.addEventListener('pointerdown', pointerDownHandler, true);

        controlDblClickHandler = (event) => {
            disarmGuard();
            event.preventDefault();
            event.stopPropagation();
        };
        container.addEventListener('dblclick', controlDblClickHandler);

        // If the first click closes the control/panel, the second click in a
        // double-click can land on the map behind it. Capture that next map
        // dblclick once, then immediately release the guard.
        documentDblClickHandler = (event) => {
            if (!swallowNextDblClick) {
                return;
            }

            disarmGuard();
            if (!(event.target instanceof Node) || !container?.contains(event.target)) {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
            }
        };
        document.addEventListener('dblclick', documentDblClickHandler, true);

        createApp(Component).use(pinia).mount(container);
        return container;
    };

    control.onRemove = () => {
        if (container && pointerDownHandler) {
            container.removeEventListener('pointerdown', pointerDownHandler, true);
        }
        if (container && controlDblClickHandler) {
            container.removeEventListener('dblclick', controlDblClickHandler);
        }
        if (documentDblClickHandler) {
            document.removeEventListener('dblclick', documentDblClickHandler, true);
        }
        if (clearGuardTimer !== null) {
            clearTimeout(clearGuardTimer);
            clearGuardTimer = null;
        }

        container = null;
        pointerDownHandler = null;
        controlDblClickHandler = null;
        documentDblClickHandler = null;
    };

    return control;
}
