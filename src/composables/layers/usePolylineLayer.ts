/**
 * usePolylineLayer.ts
 *
 * Shared factory for all polyline/polygon layers.
 * Replaces PubSub subscriptions with a sync watch on mapStore.activeLayerId
 * and a direct map.on('draw:created') listener.
 */
import * as L from 'leaflet';
import { watch } from 'vue';
import { useMapStore } from '../../stores/mapStore';
import { pinia } from '../../stores/index';
import { setMapCursor, removeMapCursor, buildToolbarButton, buildLegendEntry } from './layerUtils';
import type { IMapLayer } from './IMapLayer';

export interface PolylineLayerConfig {
    id: string;
    title: string;
    groupName: string;
    buttonId: string;
    tooltip: string;
    toggleTitle: string;
    /**
     * Create (and enable) a new Leaflet.draw tool.
     * Called when the layer is selected.
     */
    createDrawingTool: (map: L.Map) => { disable(): void };
    /**
     * Called after draw:created fires.
     * Must add the new feature to geoJsonLayer and return it.
     */
    onDrawCreated: (latLngs: L.LatLng[], geoJsonLayer: L.GeoJSON, map: L.Map) => void;
    buildIconEl: () => HTMLElement;
    iconSrc?: string;
}

export interface EditablePolylineLayer extends IMapLayer {
    /**
     * Select this layer for editing an existing feature without enabling
     * leaflet.draw create mode.
     */
    selectForEdit: () => void;
}

export function createPolylineLayer(
    config: PolylineLayerConfig,
    map: L.Map
): EditablePolylineLayer {
    const mapStore = useMapStore(pinia);
    const geoJsonLayer = new L.GeoJSON();
    let _selected = false;
    let _visible = false;
    let _drawingTool: { disable(): void } | null = null;
    let selectionMode: 'draw' | 'edit' = 'draw';
    let pendingCursorEvent: L.LeafletMouseEvent | null = null;
    let cursorSyncFrameId: number | null = null;

    const buildLayerFeatureCollection = () => {
        const json: any = { type: 'FeatureCollection', features: [] };
        geoJsonLayer.eachLayer((layer: any) => {
            const feature = layer.toGeoJSON() as any;
            feature.properties = {
                ...(feature.properties ?? {}),
                ...(layer.feature?.properties ?? {})
            };
            json.features.push(feature);
        });
        return json;
    };

    const pointFeatureClasses = [
        'modal-filter-marker',
        'bus-gate-icon',
        'traffic-lights-icon',
        'pedestrian-lights-icon',
        'zebra-crossing-icon'
    ];

    const getPointSelectCursor = (): string => {
        const mapElement = document.getElementById('map');
        const cursor = mapElement
            ? getComputedStyle(mapElement).getPropertyValue('--point-select-cursor').trim()
            : '';

        return cursor === '' ? 'pointer' : cursor;
    };

    const isPointFeatureElement = (element: Element): boolean => {
        return pointFeatureClasses.some((className) => element.classList.contains(className));
    };

    const isInteractiveShapeElement = (element: Element): boolean => {
        return (
            element.classList.contains('leaflet-interactive') ||
            element.classList.contains('leaflet-marker-icon')
        );
    };

    const isActivelyDrawing = (): boolean => {
        if (selectionMode !== 'draw' || !_selected || _drawingTool == null) {
            return false;
        }

        const markers = (_drawingTool as { _markers?: unknown[] })._markers;
        return Array.isArray(markers) && markers.length > 0;
    };

    const applyMouseMarkerCursor = (event: L.LeafletMouseEvent) => {
        const mouseMarker = document.querySelector('.leaflet-mouse-marker') as HTMLElement | null;
        if (!mouseMarker) {
            return;
        }

        if (isActivelyDrawing()) {
            mouseMarker.style.cursor = 'crosshair';
            return;
        }

        const hoverStack = document.elementsFromPoint(
            event.originalEvent.clientX,
            event.originalEvent.clientY
        );
        const isHoveringPointFeature = hoverStack.some((element) => {
            return element !== mouseMarker && isPointFeatureElement(element);
        });

        if (isHoveringPointFeature) {
            mouseMarker.style.cursor = getPointSelectCursor();
            return;
        }

        const isHoveringSameLayerFeature = hoverStack.some((element) => {
            return (
                element !== mouseMarker &&
                element.classList.contains('leaflet-interactive') &&
                element.classList.contains(config.buttonId)
            );
        });

        const isHoveringAnyInteractiveShape = hoverStack.some((element) => {
            return element !== mouseMarker && isInteractiveShapeElement(element);
        });

        if (selectionMode === 'edit') {
            if (isHoveringAnyInteractiveShape) {
                mouseMarker.style.cursor = 'pointer';
            } else {
                mouseMarker.style.cursor = 'grab';
            }
            return;
        }

        if (isHoveringSameLayerFeature) {
            mouseMarker.style.cursor = 'pointer';
        } else {
            mouseMarker.style.removeProperty('cursor');
        }
    };

    const syncMouseMarkerCursor = (event: L.LeafletMouseEvent) => {
        pendingCursorEvent = event;
        if (cursorSyncFrameId !== null) {
            return;
        }

        cursorSyncFrameId = requestAnimationFrame(() => {
            cursorSyncFrameId = null;
            const latestEvent = pendingCursorEvent;
            pendingCursorEvent = null;

            if (latestEvent) {
                applyMouseMarkerCursor(latestEvent);
            }
        });
    };

    const handleDrawCreated = (e: any) => {
        if (!_selected) {
            return;
        }
        config.onDrawCreated(e.layer.getLatLngs(), geoJsonLayer, map);
        const createdLayers = geoJsonLayer.getLayers() as any[];
        const createdLayer = createdLayers[createdLayers.length - 1];
        const createdFeature = createdLayer?.feature ?? createdLayer?.toGeoJSON?.() ?? null;
        mapStore.markLayerUpdated({
            kind: 'polyline-add',
            layerId: config.id,
            payload: createdFeature ?? e.layer.toGeoJSON?.() ?? null
        });
    };

    const disableDrawMode = () => {
        _drawingTool?.disable();
        _drawingTool = null;
        map.off('draw:created', handleDrawCreated);
    };

    watch(
        () => mapStore.activeLayerId,
        (newId) => {
            const shouldBeSelected = newId === config.buttonId;
            if (shouldBeSelected && !_selected) {
                _selected = true;
                setMapCursor(config.buttonId);
                map.on('mousemove', syncMouseMarkerCursor as L.LeafletEventHandlerFn);
                if (selectionMode === 'draw') {
                    _drawingTool = config.createDrawingTool(map);
                    map.on('draw:created', handleDrawCreated);
                }
            } else if (!shouldBeSelected && _selected) {
                _selected = false;
                disableDrawMode();
                geoJsonLayer.eachLayer((l: any) => l.editing?.disable());
                map.off('mousemove', syncMouseMarkerCursor as L.LeafletEventHandlerFn);
                if (cursorSyncFrameId !== null) {
                    cancelAnimationFrame(cursorSyncFrameId);
                    cursorSyncFrameId = null;
                }
                pendingCursorEvent = null;
                const mouseMarker = document.querySelector(
                    '.leaflet-mouse-marker'
                ) as HTMLElement | null;
                mouseMarker?.style.removeProperty('cursor');
                removeMapCursor(config.buttonId);
                selectionMode = 'draw';
            }
        },
        { flush: 'sync' }
    );

    const action = (_event: Event, _map: L.Map): void => {
        selectionMode = 'draw';
    };

    const selectForEdit = (): void => {
        selectionMode = 'edit';
        if (_selected) {
            disableDrawMode();
        }
        mapStore.setActiveLayer(config.buttonId);
    };

    const visibilityProxy = {
        get visible() {
            return _visible;
        },
        set visible(v: boolean) {
            _visible = v;
        }
    };

    return {
        id: config.id,
        title: config.title,
        get selected() {
            return _selected;
        },
        set selected(v: boolean) {
            _selected = v;
        },
        get visible() {
            return _visible;
        },
        set visible(v: boolean) {
            _visible = v;
        },
        groupName: config.groupName,
        kind: 'polyline' as const,
        iconHtml: config.buildIconEl().outerHTML,

        getToolbarButton() {
            return buildToolbarButton({
                id: config.buttonId,
                tooltip: config.tooltip,
                groupName: config.groupName,
                action,
                selected: _selected,
                iconSrc: config.iconSrc
            });
        },

        getLegendEntry() {
            return buildLegendEntry({
                layerId: config.id,
                title: config.title,
                toggleTitle: config.toggleTitle,
                iconEl: config.buildIconEl(),
                visibilityState: visibilityProxy
            });
        },

        loadFromGeoJSON(_geoJson: any): void {
            /* implemented per-layer — override by reassigning after creation */
        },

        getLayer(): L.GeoJSON {
            return geoJsonLayer;
        },
        toGeoJSON(): object {
            return buildLayerFeatureCollection();
        },
        clearLayer(): void {
            geoJsonLayer.clearLayers();
            _visible = false;
        },

        selectForEdit
    };
}
