/**
 * Unit tests for LtnLayer — polygon popup editing.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia } from 'pinia';

vi.mock('leaflet', () => import('../__mocks__/leaflet'));

import { createLtnLayer } from '../../../src/composables/layers/useLtnLayer';
import { pinia } from '../../../src/stores/index';
import { useMapStore } from '../../../src/stores/mapStore';
import { useSelectionStore } from '../../../src/stores/selectionStore';
import { makeMockMap, polygonFeatureCollection } from './LtnLayer.helpers';

describe('LtnLayer feature clicks', () => {
    beforeEach(() => {
        setActivePinia(pinia);
        useSelectionStore(pinia).deactivate();
        useMapStore(pinia).setDrawLayer(null);
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

    it('keeps LTN popup controls valid by placing group content in a list item', () => {
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
        const popupContent = polygon.__ltnPopup.setContent.mock.calls[0][0] as HTMLElement;
        const controlList = popupContent.querySelector('.ltn-popup-buttons') as HTMLUListElement;

        expect([...controlList.children].every((child) => child.tagName === 'LI')).toBe(true);
        expect(controlList.querySelector('.feature-popup-group-content')).not.toBeNull();
    });

    it('saves the title when the title input loses focus', () => {
        const map = makeMockMap();
        const layer = createLtnLayer(map);
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
        polygon.editing = { disable: vi.fn(), enable: vi.fn() };
        const mapOpenPopupSpy = vi.spyOn(map, 'openPopup');

        polygon.fire('click', {
            originalEvent: { clientX: 0, clientY: 0 },
            target: polygon
        });

        const popup = mapOpenPopupSpy.mock.calls[0][0] as any;
        const content = popup.setContent.mock.calls[0][0] as HTMLElement;
        const input = content.querySelector('.label-editor') as HTMLInputElement;

        expect(input.getAttribute('aria-label')).toBe('LTN cell label');
        mapStore.clearLastLayerMutation();
        input.value = 'Updated LTN';
        input.dispatchEvent(new Event('input', { bubbles: true }));

        expect(polygon.properties.label).toBe('Updated LTN');
        expect(mapStore.lastLayerMutation).toBeNull();
        input.dispatchEvent(new Event('change', { bubbles: true }));
        expect(mapStore.lastLayerMutation?.kind).toBe('polygon-edit');
        expect(mapOpenPopupSpy).toHaveBeenCalledWith(popup);
    });

    it('saves and closes the popup when Enter is pressed in the title input', () => {
        const map = makeMockMap();
        const layer = createLtnLayer(map);
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
        polygon.editing = { disable: vi.fn(), enable: vi.fn() };
        const mapClosePopupSpy = vi.spyOn(map, 'closePopup');
        const mapOpenPopupSpy = vi.spyOn(map, 'openPopup');

        polygon.fire('click', {
            originalEvent: { clientX: 0, clientY: 0 },
            target: polygon
        });

        const popup = mapOpenPopupSpy.mock.calls[0][0] as any;
        const input = popup.setContent.mock.calls[0][0].querySelector(
            '.label-editor'
        ) as HTMLInputElement;
        input.value = 'Updated with Enter';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

        expect(mapStore.lastLayerMutation?.kind).toBe('polygon-edit');
        expect(mapClosePopupSpy).toHaveBeenCalledWith(popup);
    });

    it('changes the cell colour from the popup swatch and records the edit', () => {
        const map = makeMockMap();
        const layer = createLtnLayer(map);
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
        const popup = polygon.__ltnPopup;
        const content = popup.setContent.mock.calls[0][0] as HTMLElement;
        const colorInput = content.querySelector('.colour-swatch') as HTMLInputElement;

        expect(colorInput.type).toBe('color');
        expect(colorInput.value).toBe('#cc00cc');

        const initialUpdateCount = mapStore.layerUpdateCount;
        colorInput.value = '#00aa11';
        colorInput.dispatchEvent(new Event('input', { bubbles: true }));
        colorInput.value = '#00aa00';
        colorInput.dispatchEvent(new Event('input', { bubbles: true }));
        colorInput.dispatchEvent(new Event('change', { bubbles: true }));

        expect(polygon.options.color).toBe('#00aa00');
        expect(mapStore.layerUpdateCount).toBe(initialUpdateCount + 1);
        expect(mapStore.lastLayerMutation?.kind).toBe('polygon-edit');
        expect(mapStore.lastLayerMutation?.payload).toMatchObject({
            beforeColor: '#cc00cc',
            afterColor: '#00aa00'
        });
    });

    it('does not render Apply or Cancel buttons in the popup', () => {
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
        const content = polygon.__ltnPopup.setContent.mock.calls[0][0] as HTMLElement;

        expect(content.querySelector('.apply-changes-button')).toBeNull();
        expect(content.querySelector('.cancel-colour-button')).toBeNull();
    });
});
