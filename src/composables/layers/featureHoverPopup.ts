/**
 * featureHoverPopup.ts
 *
 * Hover popup positioning and lifecycle helpers for feature popups.
 * Extracted from layerUtils.ts — pure mechanical split, no behavior changes.
 */
import * as L from 'leaflet';

export function addFeatureHoverPopup(
    map: L.Map,
    popup: L.Popup,
    latLng: L.LatLng,
    onPopupLeave?: () => void
): void {
    popup.setLatLng(latLng).addTo(map);

    const element = popup.getElement();
    if (!element) {
        return;
    }

    L.DomEvent.disableClickPropagation(element);
    element.addEventListener('mouseleave', () => onPopupLeave?.());

    const mapSize = map.getSize();
    const popupWidth = element.offsetWidth;
    const popupHeight = element.offsetHeight;
    const anchor = map.latLngToContainerPoint(latLng);
    const padding = 12;
    const minX = padding + popupWidth / 2;
    const maxX = Math.max(minX, mapSize.x - padding - popupWidth / 2);
    const minY = padding + popupHeight;
    const maxY = Math.max(minY, mapSize.y - padding);
    const adjustedAnchor = L.point(
        Math.min(Math.max(anchor.x, minX), maxX),
        Math.min(Math.max(anchor.y, minY), maxY)
    );

    if (adjustedAnchor.x !== anchor.x || adjustedAnchor.y !== anchor.y) {
        popup.setLatLng(map.containerPointToLatLng(adjustedAnchor));
    }

    const mapContainer = map.getContainer?.();
    if (!mapContainer) {
        return;
    }

    const legend = mapContainer.querySelector<HTMLElement>('.legend');
    if (!legend) {
        return;
    }

    const mapRect = mapContainer.getBoundingClientRect();
    const popupRect = element.getBoundingClientRect();
    const legendRect = legend.getBoundingClientRect();
    const overlapsLegend =
        popupRect.left < legendRect.right &&
        popupRect.right > legendRect.left &&
        popupRect.top < legendRect.bottom &&
        popupRect.bottom > legendRect.top;

    if (!overlapsLegend) {
        return;
    }

    const legendLeft = legendRect.left - mapRect.left;
    const shiftedLeftAnchor = legendLeft - padding - popupWidth / 2;
    if (shiftedLeftAnchor >= minX) {
        adjustedAnchor.x = Math.min(adjustedAnchor.x, shiftedLeftAnchor);
    } else {
        const legendBottom = legendRect.bottom - mapRect.top;
        const shiftedBelowAnchor = legendBottom + padding + popupHeight;
        adjustedAnchor.y = Math.min(Math.max(adjustedAnchor.y, shiftedBelowAnchor), maxY);
    }

    popup.setLatLng(map.containerPointToLatLng(adjustedAnchor));
}

export interface FeatureHoverPopupController {
    set(popup: L.Popup): void;
    close(popup: L.Popup): void;
    scheduleClose(): void;
}

export function createFeatureHoverPopupController(): FeatureHoverPopupController {
    let activePopup: L.Popup | null = null;

    const close = (popup: L.Popup): void => {
        if (activePopup !== popup) {
            return;
        }

        popup.remove();
        activePopup = null;
    };

    return {
        set(popup) {
            activePopup = popup;
        },
        close,
        scheduleClose() {
            const popup = activePopup;
            if (!popup) {
                return;
            }

            window.setTimeout(() => {
                if (activePopup === popup && !popup.getElement()?.matches(':hover')) {
                    close(popup);
                }
            }, 0);
        }
    };
}

export function getFeatureHoverLatLng(
    map: L.Map,
    featureCenter: L.LatLng,
    initialHoverLatLng: L.LatLng
): L.LatLng {
    return map.getBounds().contains(featureCenter) ? featureCenter : initialHoverLatLng;
}

export function closeFeatureHoverPopups(map: L.Map): void {
    if (typeof map.eachLayer !== 'function') {
        return;
    }

    map.eachLayer((layer: L.Layer) => {
        if ((layer as L.Popup).options?.className === 'feature-popup-hover') {
            map.removeLayer(layer);
        }
    });
}
