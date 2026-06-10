import * as L from 'leaflet';
import PubSub from 'pubsub-js';
import { EventTopics } from '../EventTopics';
import { ToolbarButton } from '../Controls/ToolbarButton';

// ---------------------------------------------------------------------------
// Cursor helpers
// ---------------------------------------------------------------------------

export function setMapCursor(cssClass: string): void {
    const map = document.getElementById('map');
    map?.classList.remove('leaflet-grab');
    map?.classList.add(cssClass);
}

export function removeMapCursor(cssClass: string): void {
    const map = document.getElementById('map');
    map?.classList.remove(cssClass);
    map?.classList.add('leaflet-grab');
}

// ---------------------------------------------------------------------------
// Selection state helpers
// ---------------------------------------------------------------------------

interface SelectionState {
    selected: boolean;
}

export function selectLayer(state: SelectionState, cursorCss: string): void {
    state.selected = true;
    setMapCursor(cursorCss);
}

export function deselectPointLayer(state: SelectionState, cursorCss: string): void {
    if (!state.selected) return;
    removeMapCursor(cursorCss);
    state.selected = false;
}

export function deselectPolylineLayer(
    state: SelectionState,
    cursorCss: string,
    geoJsonLayer: L.GeoJSON,
    drawingTool?: { disable(): void } | null
): void {
    if (!state.selected) return;
    geoJsonLayer.eachLayer((layer: any) => {
        layer.editing?.disable();
    });
    drawingTool?.disable();
    removeMapCursor(cursorCss);
    state.selected = false;
}

// ---------------------------------------------------------------------------
// Toolbar button builder
// ---------------------------------------------------------------------------

export interface ToolbarButtonOpts {
    id: string;
    tooltip: string;
    groupName: string;
    action: (e: Event, map: L.Map) => void;
    selected: boolean;
    isFirst?: boolean;
    text?: string;
}

export function buildToolbarButton(opts: ToolbarButtonOpts): ToolbarButton {
    const button = new ToolbarButton();
    button.id = opts.id;
    button.tooltip = opts.tooltip;
    button.groupName = opts.groupName;
    button.action = opts.action;
    button.selected = opts.selected;
    if (opts.isFirst !== undefined) button.isFirst = opts.isFirst;
    if (opts.text !== undefined) button.text = opts.text;
    return button;
}

// ---------------------------------------------------------------------------
// Legend entry builder
// ---------------------------------------------------------------------------

export interface LegendEntryOpts {
    layerId: string;
    title: string;
    toggleTitle: string;
    iconEl: HTMLElement;
    visibilityState: { visible: boolean };
}

export function buildLegendEntry(opts: LegendEntryOpts): HTMLElement {
    const li = document.createElement('li');
    li.id = `${opts.layerId}-legend`;
    li.setAttribute('title', opts.toggleTitle);
    li.appendChild(opts.iconEl);

    const span = document.createElement('span');
    span.textContent = opts.title;
    li.appendChild(span);

    li.addEventListener('click', () => {
        opts.visibilityState.visible = !opts.visibilityState.visible;
        PubSub.publish(
            opts.visibilityState.visible ? EventTopics.showLayer : EventTopics.hideLayer,
            opts.layerId
        );
    });

    return li;
}

// ---------------------------------------------------------------------------
// PubSub wiring helpers
// ---------------------------------------------------------------------------

export function subscribePointLayerEvents(
    layerId: string,
    state: SelectionState,
    cursorCss: string,
    addMarkerFn: (latLng: L.LatLng) => void
): void {
    PubSub.subscribe(EventTopics.layerSelected, (msg, selectedLayerId) => {
        if (selectedLayerId !== layerId) {
            deselectPointLayer(state, cursorCss);
        } else {
            selectLayer(state, cursorCss);
        }
    });
    PubSub.subscribe(EventTopics.layerDeselected, () => {
        deselectPointLayer(state, cursorCss);
    });
    PubSub.subscribe(EventTopics.mapClicked, (msg, e: L.LeafletMouseEvent) => {
        if (state.selected) {
            L.DomEvent.stopPropagation(e);
            addMarkerFn(e.latlng);
            PubSub.publish(EventTopics.layerUpdated, layerId);
        }
    });
}

export function subscribePolylineLayerEvents(
    layerId: string,
    state: SelectionState,
    cursorCss: string,
    geoJsonLayer: L.GeoJSON,
    getDrawingTool: () => { disable(): void } | null | undefined,
    onDrawCreated: (data: { latLngs: L.LatLng[]; map: L.Map }) => void
): void {
    PubSub.subscribe(EventTopics.layerSelected, (msg, selectedLayerId) => {
        if (selectedLayerId !== layerId) {
            deselectPolylineLayer(state, cursorCss, geoJsonLayer, getDrawingTool());
        } else {
            selectLayer(state, cursorCss);
        }
    });
    PubSub.subscribe(EventTopics.layerDeselected, () => {
        deselectPolylineLayer(state, cursorCss, geoJsonLayer, getDrawingTool());
    });
    PubSub.subscribe(EventTopics.drawCreated, (msg, data: { latLngs: L.LatLng[]; map: L.Map }) => {
        if (state.selected) {
            onDrawCreated(data);
            PubSub.publish(EventTopics.layerUpdated, layerId);
        }
    });
}
