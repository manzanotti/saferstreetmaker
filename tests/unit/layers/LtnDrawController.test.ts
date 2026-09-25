import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('leaflet', () => import('../__mocks__/leaflet'));

import * as L from 'leaflet';
import { createLtnDrawController } from '../../../src/composables/layers/ltnDrawController';

describe('createLtnDrawController', () => {
    let map: L.Map;
    let selected: boolean;
    let layerDisposed: boolean;
    let controller: ReturnType<typeof createLtnDrawController>;
    let popup: L.Popup;
    let labelEl: HTMLInputElement;
    let polygon: any;
    let createdLayer: any;
    let onDrawCreated: ReturnType<typeof vi.fn>;

    const fireDrawCreated = (): void => {
        map.fire('draw:created', { layer: createdLayer });
    };

    beforeEach(() => {
        vi.useFakeTimers();
        map = new L.Map();
        selected = true;
        layerDisposed = false;
        popup = { setLatLng: vi.fn().mockReturnThis() } as unknown as L.Popup;
        labelEl = document.createElement('input');
        vi.spyOn(labelEl, 'focus');
        vi.spyOn(labelEl, 'select');
        polygon = {
            __ltnPopup: popup,
            __ltnLabelEl: labelEl,
            getBounds: () => ({ getCenter: () => ({ lat: 1, lng: 2 }) })
        };
        createdLayer = {};
        onDrawCreated = vi.fn(() => polygon);
        controller = createLtnDrawController({
            map,
            color: '#cc00cc',
            isSelected: () => selected,
            isDisposed: () => layerDisposed,
            onDrawCreated
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('creates the polygon and opens its naming popup with the label focused', () => {
        const center = { lat: 1, lng: 2 };
        const openPopup = vi.spyOn(map, 'openPopup');
        controller.enable();

        fireDrawCreated();
        vi.runOnlyPendingTimers();

        expect(onDrawCreated).toHaveBeenCalledWith(createdLayer);
        expect(popup.setLatLng).toHaveBeenCalledWith(center);
        expect(openPopup).toHaveBeenCalledWith(popup);
        expect(labelEl.focus).toHaveBeenCalled();
        expect(labelEl.select).toHaveBeenCalled();
    });

    it('only focuses the label when the naming popup opens', () => {
        controller.enable();
        fireDrawCreated();

        map.fire('popupopen', { popup: {} });
        expect(labelEl.focus).not.toHaveBeenCalled();

        map.fire('popupopen', { popup });
        expect(labelEl.focus).toHaveBeenCalledOnce();
        expect(labelEl.select).toHaveBeenCalledOnce();
    });

    it('does not open the naming popup if the layer is deselected before the timeout', () => {
        const openPopup = vi.spyOn(map, 'openPopup');
        const mapOff = vi.spyOn(map, 'off');
        controller.enable();
        fireDrawCreated();
        selected = false;

        vi.runOnlyPendingTimers();

        expect(openPopup).not.toHaveBeenCalled();
        expect(mapOff).toHaveBeenCalledWith('popupopen', expect.any(Function));
    });

    it('does not open the naming popup if the layer is disposed before the timeout', () => {
        const openPopup = vi.spyOn(map, 'openPopup');
        const mapOff = vi.spyOn(map, 'off');
        controller.enable();
        fireDrawCreated();
        layerDisposed = true;

        vi.runOnlyPendingTimers();

        expect(openPopup).not.toHaveBeenCalled();
        expect(mapOff).toHaveBeenCalledWith('popupopen', expect.any(Function));
    });

    it('does not schedule a naming popup when polygon creation returns no popup', () => {
        polygon.__ltnPopup = null;
        controller.enable();

        fireDrawCreated();

        expect(vi.getTimerCount()).toBe(0);
        expect(popup.setLatLng).not.toHaveBeenCalled();
    });

    it('disposal cancels the pending popup and removes draw and popup listeners', () => {
        const closePopup = vi.spyOn(map, 'closePopup');
        const openPopup = vi.spyOn(map, 'openPopup');
        const mapOff = vi.spyOn(map, 'off');
        controller.enable();
        fireDrawCreated();

        controller.dispose();
        vi.runOnlyPendingTimers();

        expect(controller.isEnabled()).toBe(false);
        expect(closePopup).toHaveBeenCalledWith(popup);
        expect(openPopup).not.toHaveBeenCalled();
        expect(mapOff).toHaveBeenCalledWith('draw:created', expect.any(Function));
        expect(mapOff).toHaveBeenCalledWith('popupopen', expect.any(Function));
        expect(mapOff).toHaveBeenCalledWith('popupclose', expect.any(Function));
        expect(() => controller.dispose()).not.toThrow();
    });

    it('removing the naming polygon cancels its pending popup', () => {
        const closePopup = vi.spyOn(map, 'closePopup');
        const openPopup = vi.spyOn(map, 'openPopup');
        controller.enable();
        fireDrawCreated();

        controller.handleLayerRemoved({ __ltnPopup: popup });
        vi.runOnlyPendingTimers();

        expect(closePopup).toHaveBeenCalledWith(popup);
        expect(openPopup).not.toHaveBeenCalled();
    });

    it('does not cancel the naming popup when another layer is removed', () => {
        const openPopup = vi.spyOn(map, 'openPopup');
        controller.enable();
        fireDrawCreated();

        controller.handleLayerRemoved({ __ltnPopup: {} });
        vi.runOnlyPendingTimers();

        expect(openPopup).toHaveBeenCalledWith(popup);
    });

    it('does not reopen a naming popup that was already closed', () => {
        const closePopup = vi.spyOn(map, 'closePopup');
        const openPopup = vi.spyOn(map, 'openPopup');
        controller.enable();
        fireDrawCreated();
        map.fire('popupclose', { popup });

        controller.dispose();
        vi.runOnlyPendingTimers();

        expect(closePopup).not.toHaveBeenCalled();
        expect(openPopup).not.toHaveBeenCalled();
    });

    it('ignores draw events while deselected or disposed', () => {
        controller.enable();
        selected = false;
        fireDrawCreated();
        expect(onDrawCreated).not.toHaveBeenCalled();

        selected = true;
        layerDisposed = true;
        fireDrawCreated();
        expect(onDrawCreated).not.toHaveBeenCalled();
    });
});
