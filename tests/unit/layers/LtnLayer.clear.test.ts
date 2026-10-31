/**
 * Unit tests for LtnLayer composable — clearLayer() and dispose().
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('leaflet', () => import('../__mocks__/leaflet'));

import * as L from 'leaflet';
import { createLtnLayer } from '../../../src/composables/layers/useLtnLayer';
import { pinia } from '../../../src/stores/index';
import { useMapStore } from '../../../src/stores/mapStore';
import { useSelectionStore } from '../../../src/stores/selectionStore';
import { useGroupStore } from '../../../src/stores/groupStore';
import { makeMockMap, polygonFeatureCollection } from './LtnLayer.helpers';

describe('LtnLayer (composable)', () => {
    let map: L.Map;
    let layer: ReturnType<typeof createLtnLayer>;

    beforeEach(() => {
        setActivePinia(createPinia());
        map = makeMockMap();
        layer = createLtnLayer(map);
    });

    describe('clearLayer()', () => {
        it('resets visible to false', () => {
            layer.visible = true;
            layer.clearLayer();
            expect(layer.visible).toBe(false);
        });

        it('removes popup handlers when a polygon is removed', () => {
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
            const disposeHoverPopup = vi.spyOn(polygon, '__disposeLtnHoverPopup');
            const polygonOff = vi.spyOn(polygon, 'off');
            const disableEditing = vi.fn();
            polygon.editing = { disable: disableEditing };
            const input = polygon.__ltnPopup.setContent.mock.calls[0][0].querySelector(
                '.label-editor'
            ) as HTMLInputElement;
            const mapStore = useMapStore(pinia);

            layer.getLayer().removeLayer(polygon);
            mapStore.clearLastLayerMutation();
            input.value = 'Removed polygon';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));

            expect(mapStore.lastLayerMutation).toBeNull();
            expect(disposeHoverPopup).toHaveBeenCalledOnce();
            expect(disableEditing).toHaveBeenCalledOnce();
            expect(polygonOff).toHaveBeenCalledWith('click', expect.any(Function));
            expect(polygonOff).toHaveBeenCalledWith();
        });

        it('closes an open editor popup when its polygon is removed', () => {
            const mapClosePopupSpy = vi.spyOn(map, 'closePopup');
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
            const popup = polygon.__ltnPopup;

            map.openPopup(popup);
            layer.getLayer().removeLayer(polygon);

            expect(mapClosePopupSpy).toHaveBeenCalledWith(popup);
        });

        it('disposes popup action and group controls when a polygon is removed', () => {
            const mapStore = useMapStore(pinia);
            const selectionStore = useSelectionStore(pinia);
            const groupStore = useGroupStore(pinia);
            const historyId = 'ltn-popup-cleanup';
            groupStore.setGroups([
                {
                    id: 'group-1',
                    name: 'Group 1',
                    members: [{ layerId: 'LtnCells', historyId }]
                }
            ]);
            const featureCollection = polygonFeatureCollection([
                [
                    [
                        [0, 0],
                        [1, 0],
                        [1, 1],
                        [0, 1],
                        [0, 0]
                    ]
                ]
            ]);
            featureCollection.features[0].properties.historyId = historyId;
            layer.loadFromGeoJSON(featureCollection as any);

            const polygon = layer.getLayer().getLayers()[0] as any;
            const content = polygon.__ltnPopup.setContent.mock.calls[0][0] as HTMLElement;
            const copyButton = content.querySelector('.copy-button') as HTMLButtonElement;
            const deleteButton = content.querySelector('.delete-button') as HTMLButtonElement;
            const groupRemoveButton = content.querySelector(
                '.remove-feature-button'
            ) as HTMLButtonElement;
            const initialGroupMembers = groupStore.groups[0].members;

            layer.getLayer().removeLayer(polygon);
            mapStore.clearLastLayerMutation();

            copyButton.click();
            deleteButton.click();
            groupRemoveButton.click();

            expect(selectionStore.selected).toHaveLength(0);
            expect(mapStore.lastLayerMutation).toBeNull();
            expect(groupStore.groups[0].members).toEqual(initialGroupMembers);
        });
    });

    describe('dispose()', () => {
        it('removes layer-level listeners and clears terminal layer data', () => {
            const mapOffSpy = vi.spyOn(map, 'off');
            const mapClosePopupSpy = vi.spyOn(map, 'closePopup');
            const mapRemoveLayerSpy = vi.spyOn(map, 'removeLayer');
            layer.visible = true;
            const mapStore = useMapStore(pinia);
            mapStore.visibleLayerIds = new Set(['LtnCells', 'MobilityLanes']);
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
            const popup = polygon.__ltnPopup;
            const polygonOffSpy = vi.spyOn(polygon, 'off');
            map.openPopup(popup);

            layer.dispose?.();

            expect(mapOffSpy).toHaveBeenCalledWith('popupclose', expect.any(Function));
            expect(mapOffSpy).toHaveBeenCalledWith('zoomend', expect.any(Function));
            expect(mapOffSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
            expect(mapClosePopupSpy).toHaveBeenCalledWith(popup);
            expect(mapRemoveLayerSpy).toHaveBeenCalledWith(layer.getLayer());
            expect(polygonOffSpy).toHaveBeenCalledWith();
            expect(layer.getLayer().getLayers()).toHaveLength(0);
            expect(layer.selected).toBe(false);
            expect(mapStore.visibleLayerIds).toEqual(new Set(['MobilityLanes']));
            expect(() => layer.dispose?.()).not.toThrow();
        });

        it('resets edit state before the layer is reused', () => {
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

            polygon.fire('click', {
                originalEvent: { clientX: 0, clientY: 0 },
                target: polygon
            });
            const mapStore = useMapStore(pinia);
            const selectionStore = useSelectionStore(pinia);
            expect(selectionStore.selected).toHaveLength(5);
            layer.dispose?.();
            expect(mapStore.activeLayerId).toBeNull();
            expect(selectionStore.selected).toHaveLength(0);
            mapStore.setActiveLayer(null);
            mapStore.setActiveLayer('ltn');

            expect(polygon.editing.disable).toHaveBeenCalled();
            expect(layer.selected).toBe(false);
        });
    });
});
