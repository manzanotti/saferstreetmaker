import * as L from 'leaflet';
import type { SelectedMarker } from '../../stores/selectionStore';
import type { SelectionHighlighter } from './SelectionHighlighter';

const RECT_STYLE: L.PathOptions = {
    color: '#3b82f6',
    weight: 2,
    fill: true,
    fillOpacity: 0.08,
    dashArray: '6 4',
    interactive: false
};

interface AreaSelectionControllerOptions {
    map: L.Map;
    highlighter: SelectionHighlighter;
    getSelected: () => SelectedMarker[];
    setSelected: (markers: SelectedMarker[]) => void;
    mergeSelected: (markers: SelectedMarker[]) => SelectedMarker[];
    clearSelection: () => void;
    setLastAreaBounds: (bounds: L.LatLngBounds) => void;
    findMarkersInBounds: (bounds: L.LatLngBounds) => SelectedMarker[];
    getDrawLayerId: () => string | null;
    setDrawLayer: (id: string | null) => void;
    clearAddToGroupTarget: () => void;
    isSelectionActive: () => boolean;
    deactivateSelection: () => void;
}

export class AreaSelectionController {
    private readonly map: L.Map;
    private origin: L.LatLng | null = null;
    private selectionRectangle: L.Rectangle | null = null;
    private previousDrawLayerId: string | null = null;
    private additiveDrag = false;
    private active = false;

    constructor(private readonly options: AreaSelectionControllerOptions) {
        this.map = options.map;
        this.map.on('keyup', this.onKeyUp);
    }

    activate(): void {
        if (this.active) {
            return;
        }

        this.active = true;
        this.previousDrawLayerId = this.options.getDrawLayerId();
        this.options.setDrawLayer(null);
        this.map.closePopup();
        this.map.dragging.disable();
        this.map.getContainer().classList.add('area-select');
        this.map.on('mousedown', this.onMouseDown);
    }

    deactivate(): void {
        if (!this.active) {
            return;
        }

        this.active = false;
        this.map.dragging.enable();
        this.map.getContainer().classList.remove('area-select');
        this.map.off('mousedown', this.onMouseDown);
        this.map.off('mousemove', this.onMouseMove);
        this.map.off('mouseup', this.onMouseUp);
        this.origin = null;
        this.options.highlighter.clear(this.options.getSelected());
        this.removeRectangle();
        this.options.setDrawLayer(this.previousDrawLayerId);
        this.previousDrawLayerId = null;
        this.options.clearAddToGroupTarget();
    }

    dispose(): void {
        this.deactivate();
        this.map.off('keyup', this.onKeyUp);
    }

    private readonly onKeyUp = (event: L.LeafletKeyboardEvent): void => {
        if (event.originalEvent.key === 'Escape' && this.options.isSelectionActive()) {
            this.options.deactivateSelection();
        }
    };

    private readonly onMouseDown = (event: L.LeafletMouseEvent): void => {
        const target = event.originalEvent.target;
        const isModifierClick =
            event.originalEvent.shiftKey ||
            event.originalEvent.ctrlKey ||
            event.originalEvent.metaKey;
        if (
            isModifierClick &&
            target instanceof Element &&
            (target.classList.contains('leaflet-interactive') ||
                target.classList.contains('leaflet-marker-icon'))
        ) {
            return;
        }

        L.DomEvent.stopPropagation(event.originalEvent);
        event.originalEvent.preventDefault();
        this.additiveDrag =
            event.originalEvent.shiftKey ||
            event.originalEvent.ctrlKey ||
            event.originalEvent.metaKey;
        this.origin = event.latlng;

        if (!this.additiveDrag) {
            this.options.highlighter.clear(this.options.getSelected());
            this.options.clearSelection();
        }

        this.removeRectangle();
        this.map.on('mousemove', this.onMouseMove);
        this.map.on('mouseup', this.onMouseUp);
    };

    private readonly onMouseMove = (event: L.LeafletMouseEvent): void => {
        if (!this.origin) {
            return;
        }

        const bounds = L.latLngBounds(this.origin, event.latlng);
        if (!this.selectionRectangle) {
            this.selectionRectangle = L.rectangle(bounds, RECT_STYLE).addTo(this.map);
        } else {
            this.selectionRectangle.setBounds(bounds);
        }
    };

    private readonly onMouseUp = (event: L.LeafletMouseEvent): void => {
        this.map.off('mousemove', this.onMouseMove);
        this.map.off('mouseup', this.onMouseUp);
        if (!this.origin) {
            return;
        }

        const bounds = L.latLngBounds(this.origin, event.latlng);
        this.origin = null;
        this.options.setLastAreaBounds(bounds);
        const found = this.options.findMarkersInBounds(bounds);

        if (this.additiveDrag) {
            const added = this.options.mergeSelected(found);
            if (added.length > 0) {
                this.options.highlighter.add(added);
            }
            return;
        }

        this.options.setSelected(found);
        if (found.length > 0) {
            this.options.highlighter.add(found);
        }
    };

    private removeRectangle(): void {
        this.selectionRectangle?.remove();
        this.selectionRectangle = null;
    }
}
