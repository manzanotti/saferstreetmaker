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
            drawingTool = new L.Draw.Polygon(map, { color });
            drawingTool.enable();
            map.on('draw:created', handleDrawCreated);
        },

        disable(): void {
            drawingTool?.disable();
            drawingTool = null;
            map.off('draw:created', handleDrawCreated);
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
