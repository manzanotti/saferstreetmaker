/**
 * Unit tests for LtnLayer composable.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('leaflet', () => import('../__mocks__/leaflet'));

import * as L from 'leaflet';
import { createLtnLayer } from '../../../src/composables/layers/useLtnLayer';
import { pinia } from '../../../src/stores/index';
import { useMapStore } from '../../../src/stores/mapStore';
import { useSelectionStore } from '../../../src/stores/selectionStore';
import { selectFeature } from '../../../src/composables/useAreaSelection';

function makeMockMap(): L.Map {
    return new L.Map();
}

function polygonFeatureCollection(polygons: [number, number][][][]) {
    return {
        features: polygons.map((rings) => ({
            geometry: { type: 'Polygon', coordinates: rings },
            properties: { label: 'LTN 1', color: '#cc00cc' }
        }))
    };
}

describe('LtnLayer (composable)', () => {
    let map: L.Map;
    let layer: ReturnType<typeof createLtnLayer>;

    beforeEach(() => {
        setActivePinia(createPinia());
        map = makeMockMap();
        layer = createLtnLayer(map);
    });

    it('has correct id', () => expect(layer.id).toBe('LtnCells'));
    it('has correct title', () => expect(layer.title).toBe('LTN Cells'));
    it('groupName is empty string', () => expect(layer.groupName).toBe(''));
    it('starts deselected', () => expect(layer.selected).toBe(false));
    it('starts invisible', () => expect(layer.visible).toBe(false));

    it('getLayer returns a GeoJSON instance', () => {
        expect(layer.getLayer()).toBeDefined();
    });

    describe('getToolbarButton()', () => {
        it('returns id "ltn"', () => {
            expect(layer.getToolbarButton().id).toBe('ltn');
        });

        it('has text "LTN"', () => {
            expect(layer.getToolbarButton().text).toBe('LTN');
        });

        it('has a non-empty tooltip', () => {
            expect(layer.getToolbarButton().tooltip.length).toBeGreaterThan(0);
        });

        it('reflects selected state', () => {
            layer.selected = true;
            expect(layer.getToolbarButton().selected).toBe(true);
        });
    });

    describe('getLegendEntry()', () => {
        it('returns an HTMLElement', () => {
            expect(layer.getLegendEntry()).toBeInstanceOf(HTMLElement);
        });

        it('element id is LtnCells-legend', () => {
            expect(layer.getLegendEntry().id).toBe('LtnCells-legend');
        });

        it('contains "LTN Cells" as text', () => {
            expect(layer.getLegendEntry().textContent).toContain('LTN Cells');
        });

        it('click toggles visible flag', () => {
            const el = layer.getLegendEntry();
            el.click();
            expect(layer.visible).toBe(true);
            el.click();
            expect(layer.visible).toBe(false);
        });
    });

    describe('clearLayer()', () => {
        it('resets visible to false', () => {
            layer.visible = true;
            layer.clearLayer();
            expect(layer.visible).toBe(false);
        });
    });

    describe('loadFromGeoJSON()', () => {
        it('handles null gracefully', () => {
            expect(() => (layer as any).loadFromGeoJSON(null)).not.toThrow();
        });

        it('accepts an empty feature collection', () => {
            expect(() => layer.loadFromGeoJSON({ features: [] } as any)).not.toThrow();
        });

        it('loads polygon features', () => {
            const addLayerSpy = vi.spyOn(layer.getLayer(), 'addLayer');
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
            expect(addLayerSpy).toHaveBeenCalledTimes(1);
        });

        it('loads multiple polygon features', () => {
            const addLayerSpy = vi.spyOn(layer.getLayer(), 'addLayer');
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
            expect(addLayerSpy).toHaveBeenCalledTimes(2);
        });

        it('keeps labels hidden when loading at low zoom', () => {
            vi.spyOn(map, 'getZoom').mockReturnValue(10);
            const closeTooltipSpy = vi.spyOn(L.Polygon.prototype, 'closeTooltip');

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

            expect(closeTooltipSpy).toHaveBeenCalled();
        });

        it('shows labels when loading at high zoom', () => {
            vi.spyOn(map, 'getZoom').mockReturnValue(15);
            const openTooltipSpy = vi.spyOn(L.Polygon.prototype, 'openTooltip');

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

            expect(openTooltipSpy).toHaveBeenCalled();
        });

        it('keeps labels hidden when polygon is added to map at low zoom', () => {
            vi.spyOn(map, 'getZoom').mockReturnValue(10);

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

            const closeTooltipSpy = vi.spyOn(L.Polygon.prototype, 'closeTooltip');
            const polygon = layer.getLayer().getLayers()[0] as any;
            const addHandlers = (polygon._handlers?.add ?? []) as Array<() => void>;
            addHandlers.forEach((handler) => {
                handler();
            });

            expect(closeTooltipSpy).toHaveBeenCalled();
        });
    });

    describe('toGeoJSON()', () => {
        it('returns a FeatureCollection', () => {
            const json = layer.toGeoJSON() as any;
            expect(json.type).toBe('FeatureCollection');
            expect(Array.isArray(json.features)).toBe(true);
        });
    });
});

describe('LtnLayer history payloads', () => {
    beforeEach(() => {
        setActivePinia(pinia);
    });

    it('emits compact coordinates and metadata for polygon edits', () => {
        const layer = createLtnLayer(makeMockMap());
        const mapStore = useMapStore(pinia);

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
        polygon.latlngs = [
            new L.LatLng(0, 0),
            new L.LatLng(0, 2),
            new L.LatLng(2, 2),
            new L.LatLng(2, 0),
            new L.LatLng(0, 0)
        ];
        polygon.properties.label = 'LTN 2';
        polygon.options.color = '#00aa00';
        polygon.fire('edit');

        expect(mapStore.lastLayerMutation?.kind).toBe('polygon-edit');
        expect(mapStore.lastLayerMutation?.layerId).toBe('LtnCells');
        expect(mapStore.lastLayerMutation?.payload).toMatchObject({
            historyId: expect.any(String),
            pointChanges: [
                {
                    type: 'update',
                    ringIndex: 0,
                    pointIndex: 1,
                    before: [1, 0],
                    after: [2, 0]
                },
                {
                    type: 'update',
                    ringIndex: 0,
                    pointIndex: 2,
                    before: [1, 1],
                    after: [2, 2]
                },
                {
                    type: 'update',
                    ringIndex: 0,
                    pointIndex: 3,
                    before: [0, 1],
                    after: [0, 2]
                }
            ],
            beforeLabel: 'LTN 1',
            afterLabel: 'LTN 2',
            beforeColor: '#cc00cc',
            afterColor: '#00aa00'
        });
    });

    it('emits insert operations when a polygon gains a vertex', () => {
        const layer = createLtnLayer(makeMockMap());
        const mapStore = useMapStore(pinia);

        layer.loadFromGeoJSON(
            polygonFeatureCollection([
                [
                    [
                        [0, 0],
                        [1, 0],
                        [1, 1],
                        [0, 0]
                    ]
                ]
            ]) as any
        );

        const polygon = layer.getLayer().getLayers()[0] as any;
        polygon.latlngs = [
            new L.LatLng(0, 0),
            new L.LatLng(0, 1),
            new L.LatLng(1, 1),
            new L.LatLng(1, 0),
            new L.LatLng(0, 0)
        ];
        polygon.fire('edit');

        expect(mapStore.lastLayerMutation?.payload).toMatchObject({
            historyId: expect.any(String),
            pointChanges: [
                {
                    type: 'insert',
                    ringIndex: 0,
                    pointIndex: 3,
                    after: [0, 1]
                }
            ]
        });
    });

    it('recenters the tooltip when an edited polygon changes shape', () => {
        const layer = createLtnLayer(makeMockMap());

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
        const nextCenter = new L.LatLng(9, 9);
        const setLatLngSpy = vi.fn();
        polygon.getBounds = () => ({ getCenter: () => nextCenter });
        polygon.getTooltip = () => ({ setLatLng: setLatLngSpy });

        polygon.fire('edit');

        expect(setLatLngSpy).toHaveBeenCalledWith(nextCenter);
    });

    it('re-enables polygon drawing when polygons are reloaded while the LTN tool stays armed', () => {
        const map = makeMockMap();
        const layer = createLtnLayer(map);
        const mapStore = useMapStore(pinia);
        const enableSpy = vi.spyOn((L.Draw.Polygon as any).prototype, 'enable');

        mapStore.setDrawLayer(null);
        mapStore.setDrawLayer('ltn');
        layer.selectForEdit();
        layer.getToolbarButton().action(new Event('click'), map);
        const enableCountBeforeReload = enableSpy.mock.calls.length;

        layer.loadFromGeoJSON(
            polygonFeatureCollection([
                [
                    [
                        [0, 0],
                        [1, 0],
                        [1, 1],
                        [0, 0]
                    ]
                ]
            ]) as any
        );

        expect(enableSpy.mock.calls.length).toBe(enableCountBeforeReload + 1);
        expect(layer.getLayer().getLayers()).toHaveLength(1);
    });

    it('re-enables polygon drawing when undo reloads an empty LTN layer', () => {
        const map = makeMockMap();
        const layer = createLtnLayer(map);
        const mapStore = useMapStore(pinia);
        const enableSpy = vi.spyOn((L.Draw.Polygon as any).prototype, 'enable');

        mapStore.setDrawLayer(null);
        mapStore.setDrawLayer('ltn');
        const enableCountBeforeReload = enableSpy.mock.calls.length;

        layer.loadFromGeoJSON({ features: [] } as any);

        expect(enableSpy.mock.calls.length).toBe(enableCountBeforeReload + 1);
        expect(layer.getLayer().getLayers()).toHaveLength(0);
    });
});

describe('LtnLayer feature clicks', () => {
    beforeEach(() => {
        setActivePinia(pinia);
        useSelectionStore(pinia).deactivate();
        useMapStore(pinia).setDrawLayer(null);
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

    it('focuses the title input when the polygon popup opens in edit mode', () => {
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
        polygon.editing = { disable: vi.fn(), enable: vi.fn() };
        const focusSpy = vi.spyOn(HTMLInputElement.prototype, 'focus');

        polygon.fire('click', {
            originalEvent: { clientX: 0, clientY: 0 },
            target: polygon
        });

        expect(focusSpy).toHaveBeenCalled();
    });

    it('saves the title and closes the popup when Enter is pressed in the title input', () => {
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
        polygon.editing = { disable: vi.fn(), enable: vi.fn() };
        const mapClosePopupSpy = vi.spyOn(map, 'closePopup');
        const mapOpenPopupSpy = vi.spyOn(map, 'openPopup');

        polygon.fire('click', {
            originalEvent: { clientX: 0, clientY: 0 },
            target: polygon
        });

        const popup = mapOpenPopupSpy.mock.calls[0][0] as any;
        const content = popup.setContent.mock.calls[0][0] as HTMLElement;
        const input = content.querySelector('.label-editor') as HTMLInputElement;

        input.value = 'Updated LTN';
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

        expect(polygon.properties.label).toBe('Updated LTN');
        expect(mapClosePopupSpy).toHaveBeenCalledWith(popup);
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
