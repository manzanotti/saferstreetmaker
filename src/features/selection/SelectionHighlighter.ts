import * as L from 'leaflet';
import type { SelectedMarker } from '../../stores/selectionStore';

const HIGHLIGHT_STYLE: L.PathOptions = {
    color: '#3b82f6',
    weight: 3
};

const VERTEX_HANDLE_STYLE: L.CircleMarkerOptions = {
    radius: 5,
    weight: 2,
    color: '#3b82f6',
    fillColor: '#ffffff',
    fillOpacity: 1,
    interactive: false
};

const SELECTED_CLASS = 'area-selected';

export class SelectionHighlighter {
    private handleLayer: L.LayerGroup | null = null;
    private readonly originalStyles = new WeakMap<object, L.PathOptions>();

    constructor(private readonly map: L.Map) {}

    add(markers: SelectedMarker[]): void {
        if (!this.handleLayer) {
            this.handleLayer = L.layerGroup().addTo(this.map);
        }

        for (const { marker, latLng } of markers) {
            const pointMarker = marker as L.Layer & {
                getLatLng?: () => L.LatLng;
                getElement?: () => HTMLElement | undefined;
                setStyle?: (style: L.PathOptions) => void;
                options?: L.PathOptions;
            };

            if (typeof pointMarker.getLatLng !== 'function') {
                L.circleMarker(latLng, VERTEX_HANDLE_STYLE).addTo(this.handleLayer);
                continue;
            }

            if (typeof pointMarker.setStyle === 'function') {
                this.originalStyles.set(marker as object, {
                    color: pointMarker.options?.color,
                    weight: pointMarker.options?.weight
                });
                pointMarker.setStyle(HIGHLIGHT_STYLE);
            } else {
                pointMarker.getElement?.()?.classList.add(SELECTED_CLASS);
            }
        }
    }

    replace(previousMarkers: SelectedMarker[], nextMarkers: SelectedMarker[]): void {
        this.clear(previousMarkers);
        this.add(nextMarkers);
    }

    clear(markers: SelectedMarker[]): void {
        for (const { marker } of markers) {
            const pointMarker = marker as L.Layer & {
                getLatLng?: () => L.LatLng;
                getElement?: () => HTMLElement | undefined;
                setStyle?: (style: L.PathOptions) => void;
            };

            if (typeof pointMarker.getLatLng !== 'function') {
                continue;
            }

            if (typeof pointMarker.setStyle === 'function') {
                const originalStyle = this.originalStyles.get(marker as object);
                if (originalStyle) {
                    pointMarker.setStyle(originalStyle);
                    this.originalStyles.delete(marker as object);
                }
            } else {
                pointMarker.getElement?.()?.classList.remove(SELECTED_CLASS);
            }
        }

        this.handleLayer?.remove();
        this.handleLayer = null;
    }
}
