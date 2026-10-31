/**
 * Unit tests for LtnLayer — feature click selection.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia } from 'pinia';

vi.mock('leaflet', () => import('../__mocks__/leaflet'));

import * as L from 'leaflet';
import { createLtnLayer } from '../../../src/composables/layers/useLtnLayer';
import { pinia } from '../../../src/stores/index';
import { useMapStore } from '../../../src/stores/mapStore';
import { useSelectionStore } from '../../../src/stores/selectionStore';
import { selectFeature } from '../../../src/composables/useAreaSelection';
import { SelectionHighlighter } from '../../../src/features/selection/SelectionHighlighter';
import {
    releaseSelectionHighlighter,
    setSelectionHighlighter
} from '../../../src/features/selection/featureSelection';
import { makeMockMap, polygonFeatureCollection } from './LtnLayer.helpers';

describe('LtnLayer feature clicks', () => {
    beforeEach(() => {
        setActivePinia(pinia);
        useSelectionStore(pinia).deactivate();
        useMapStore(pinia).setDrawLayer(null);
    });

    it('restores retained group-selection handles when leaving LTN edit mode', () => {
        const map = makeMockMap();
        const layer = createLtnLayer(map);
        const highlighter = new SelectionHighlighter(map);
        const circleMarker = vi.spyOn(L, 'circleMarker');
        setSelectionHighlighter(highlighter);
        try {
            layer.loadFromGeoJSON(
                polygonFeatureCollection([
                    [
                        [
                            [0, 0],
                            [1, 0],
                            [1, 1],
                            [0, 1],
                            [0, 0]
                        ]
                    ]
                ])
            );
            const polygon = layer.getLayer().getLayers()[0] as L.Polygon;
            let editingEnabled = false;
            Object.assign(polygon, {
                editing: {
                    enable: () => {
                        editingEnabled = true;
                    },
                    disable: () => {
                        editingEnabled = false;
                    },
                    enabled: () => editingEnabled
                }
            });
            polygon.fire('click', {
                originalEvent: { clientX: 0, clientY: 0 },
                target: polygon
            });
            const selectionStore = useSelectionStore(pinia);
            const entries = selectionStore.selected;
            selectionStore.markGroupSelection('group-1');
            circleMarker.mockClear();

            useMapStore(pinia).setActiveLayer('modal-filter');

            expect(editingEnabled).toBe(false);
            expect(selectionStore.isActive).toBe(false);
            expect(selectionStore.isGroupSelection).toBe(true);
            expect(selectionStore.selected).toBe(entries);
            expect(circleMarker).toHaveBeenCalledTimes(entries.length);
        } finally {
            highlighter.clear(useSelectionStore(pinia).selected);
            releaseSelectionHighlighter(highlighter);
            circleMarker.mockRestore();
            layer.dispose?.();
        }
    });

    it('replaces the previously selected polygon on a plain click', () => {
        const map = makeMockMap();
        const layer = createLtnLayer(map);

        layer.loadFromGeoJSON(
            polygonFeatureCollection([
                [
                    [
                        [0, 0],
                        [1, 0],
                        [1, 1],
                        [0, 1],
                        [0, 0]
                    ]
                ],
                [
                    [
                        [2, 2],
                        [3, 2],
                        [3, 3],
                        [2, 3],
                        [2, 2]
                    ]
                ]
            ]) as any
        );

        const [polygon1, polygon2] = layer.getLayer().getLayers() as any[];
        polygon1.editing = { disable: vi.fn(), enable: vi.fn() };
        polygon2.editing = { disable: vi.fn(), enable: vi.fn() };

        const selectionStore = useSelectionStore(pinia);
        selectionStore.activate();
        selectFeature(polygon1 as unknown as L.Layer, 'LtnCells', false, true);

        polygon2.fire('click', {
            originalEvent: { clientX: 0, clientY: 0 },
            target: polygon2
        });

        expect(selectionStore.selected).toHaveLength(5);
        expect(selectionStore.selected.every((entry) => entry.marker === polygon2)).toBe(true);
    });

    it('toggles a group-selected polygon off across active layers', () => {
        const map = makeMockMap();
        const layer = createLtnLayer(map);

        layer.loadFromGeoJSON(
            polygonFeatureCollection([
                [
                    [
                        [0, 0],
                        [1, 0],
                        [1, 1],
                        [0, 1],
                        [0, 0]
                    ]
                ]
            ]) as any
        );

        const polygon = layer.getLayer().getLayers()[0] as any;
        const selectionStore = useSelectionStore(pinia);
        const mapStore = useMapStore(pinia);
        selectFeature(polygon as unknown as L.Layer, 'LtnCells', false, true);
        selectionStore.markGroupSelection('group-1');
        mapStore.setActiveLayer('modal-filter');

        polygon.fire('click', {
            originalEvent: { shiftKey: true },
            target: polygon
        });

        expect(selectionStore.selected).toHaveLength(0);
    });

    it('switches selection to a polygon while another editable layer is active', () => {
        const map = makeMockMap();
        const ltnLayer = createLtnLayer(map);

        ltnLayer.loadFromGeoJSON(
            polygonFeatureCollection([
                [
                    [
                        [2, 2],
                        [3, 2],
                        [3, 3],
                        [2, 3],
                        [2, 2]
                    ]
                ]
            ]) as any
        );

        const polygon = ltnLayer.getLayer().getLayers()[0] as any;
        polygon.editing = { disable: vi.fn(), enable: vi.fn() };

        const selectionStore = useSelectionStore(pinia);
        const mapStore = useMapStore(pinia);
        selectionStore.activate();
        mapStore.setActiveLayer('mobility-lane');

        polygon.fire('click', {
            originalEvent: { clientX: 0, clientY: 0 },
            target: polygon
        });

        expect(mapStore.activeLayerId).toBe('ltn');
        expect(selectionStore.selected).toHaveLength(5);
        expect(selectionStore.selected.every((entry) => entry.marker === polygon)).toBe(true);
    });
});
