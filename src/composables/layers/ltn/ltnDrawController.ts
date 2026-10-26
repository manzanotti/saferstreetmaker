import * as L from 'leaflet';

interface LtnDrawControllerOptions {
    map: L.Map;
    color: string;
    isSelected: () => boolean;
    isDisposed: () => boolean;
    onDrawCreated: (layer: any) => any;
}

export function createLtnDrawController(options: LtnDrawControllerOptions) {
    const { map, color, isSelected, isDisposed, onDrawCreated } = options;
    let drawingTool: any = null;
    let drawPopup: L.Popup | null = null;
    let drawPopupTimeoutId: number | null = null;
    let removeDrawPopupFocusHandler: (() => void) | null = null;
    let disposed = false;

    const handleExistingPolygonMouseDown = (event: MouseEvent): void => {
        if (
            disposed ||
            isDisposed() ||
            !isSelected() ||
            !drawingTool ||
            event.button !== 0 ||
            drawingTool._markers?.length > 0 ||
            !(event.target instanceof Element) ||
            !event.target.classList.contains('leaflet-mouse-marker')
        ) {
            return;
        }

        const elements = document.elementsFromPoint(event.clientX, event.clientY);
        const polygons = new Map<Element, L.Polygon>();
        map.eachLayer((layer) => {
            if (layer instanceof L.Polygon) {
                const element = layer.getElement();
                if (element?.classList.contains('ltn-cell')) {
                    polygons.set(element, layer);
                }
            }
        });
        const polygon = elements.map((element) => polygons.get(element)).find((layer) => layer);
        if (!polygon) {
            return;
        }

        // The draw handler's transparent marker otherwise consumes the polygon click.
        event.preventDefault();
        event.stopPropagation();
        polygon.fire('click', {
            originalEvent: event,
            latlng: map.mouseEventToLatLng(event)
        });
    };

    const closeNamingPopup = (): void => {
        if (drawPopupTimeoutId !== null) {
            window.clearTimeout(drawPopupTimeoutId);
            drawPopupTimeoutId = null;
        }
        removeDrawPopupFocusHandler?.();
        if (drawPopup) {
            map.closePopup(drawPopup);
            drawPopup = null;
        }
    };

    const handleDrawCreated = (event: any): void => {
        if (disposed || isDisposed() || !isSelected()) {
            return;
        }

        const polygon = onDrawCreated(event.layer);
        const popup = polygon?.__ltnPopup as L.Popup | undefined;
        const labelEl = polygon?.__ltnLabelEl as HTMLInputElement | undefined;
        if (!popup) {
            return;
        }

        popup.setLatLng(polygon.getBounds().getCenter());
        drawPopup = popup;
        const focusDrawPopupLabel = (popupEvent: L.PopupEvent): void => {
            if (popupEvent.popup !== popup) {
                return;
            }

            map.off('popupopen', focusDrawPopupLabel);
            removeDrawPopupFocusHandler = null;
            labelEl?.focus();
            labelEl?.select();
        };
        removeDrawPopupFocusHandler = () => {
            map.off('popupopen', focusDrawPopupLabel);
            removeDrawPopupFocusHandler = null;
        };
        map.on('popupopen', focusDrawPopupLabel);
        drawPopupTimeoutId = window.setTimeout(() => {
            drawPopupTimeoutId = null;
            if (disposed || isDisposed() || !isSelected() || drawPopup !== popup) {
                removeDrawPopupFocusHandler?.();
                return;
            }

            map.openPopup(popup);
            labelEl?.focus();
            labelEl?.select();
        }, 0);
    };

    const handlePopupClose = (event: L.PopupEvent): void => {
        if (event.popup === drawPopup) {
            drawPopup = null;
        }
    };
    map.on('popupclose', handlePopupClose);

    return {
        enable(): void {
            drawingTool = new L.Draw.Polygon(map, { color, repeatMode: true });
            drawingTool.enable();
            map.on('draw:created', handleDrawCreated);
            map.getContainer().addEventListener('mousedown', handleExistingPolygonMouseDown, true);
        },

        disable(): void {
            drawingTool?.disable();
            drawingTool = null;
            map.off('draw:created', handleDrawCreated);
            map.getContainer().removeEventListener(
                'mousedown',
                handleExistingPolygonMouseDown,
                true
            );
        },

        isEnabled(): boolean {
            return drawingTool !== null;
        },

        closeNamingPopup,

        handleLayerRemoved(layer: any): void {
            if (drawPopup && layer?.__ltnPopup === drawPopup) {
                closeNamingPopup();
            }
        },

        dispose(): void {
            if (disposed) {
                return;
            }
            disposed = true;
            this.disable();
            closeNamingPopup();
            map.off('popupclose', handlePopupClose);
        }
    };
}
