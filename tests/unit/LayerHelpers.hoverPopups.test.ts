/**
 * Unit tests for layer helpers — feature hover popups.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('leaflet', () => import('./__mocks__/leaflet'));

import * as L from 'leaflet';
import { buildFeatureDescriptionPopup } from '../../src/composables/layers/features/featureDescriptionPopup';
import {
    addFeatureHoverPopup,
    createFeatureHoverPopupController,
    getFeatureHoverLatLng,
    closeFeatureHoverPopups
} from '../../src/composables/layers/features/featureHoverPopups';
import { useGroupStore } from '../../src/stores/groupStore';
import { pinia } from '../../src/stores';
import { useSelectionStore } from '../../src/stores/selectionStore';

beforeEach(() => {
    document.getElementById('map')?.remove();
    document.querySelector('.leaflet-mouse-marker')?.remove();
    vi.clearAllMocks();
    useGroupStore(pinia).setGroups([]);
    useSelectionStore(pinia).deactivate();
});

describe('feature popups', () => {
    const member = { layerId: 'ModalFilters', historyId: 'filter-1' };

    function getPopupContent(popup: any): HTMLElement {
        return popup.setContent.mock.calls[0][0] as HTMLElement;
    }

    it('suppresses hover popups when any membership matches the selected group', () => {
        useGroupStore(pinia).setGroups([
            { id: 'g1', name: 'Other group', members: [member] },
            { id: 'g2', name: 'Edited group', members: [member] }
        ]);
        useSelectionStore(pinia).markGroupSelection('g2');

        expect(
            buildFeatureDescriptionPopup({}, member, 'hover', {
                featureName: 'Named feature'
            })
        ).toBeNull();
        expect(buildFeatureDescriptionPopup({}, member, 'click')).not.toBeNull();

        useSelectionStore(pinia).clear();
        expect(buildFeatureDescriptionPopup({}, member)).not.toBeNull();
    });

    it('keeps hover popups for members of other groups while editing a group', () => {
        useGroupStore(pinia).setGroups([
            { id: 'g1', name: 'Other group', members: [member] },
            { id: 'g2', name: 'Edited group', members: [] }
        ]);
        useSelectionStore(pinia).markGroupSelection('g2');

        expect(buildFeatureDescriptionPopup({}, member)).not.toBeNull();
    });

    it('keeps hover popups near the feature while clamping them to the viewport', () => {
        const popupElement = document.createElement('div');
        Object.defineProperties(popupElement, {
            offsetWidth: { value: 100 },
            offsetHeight: { value: 80 }
        });

        const popup = {
            setLatLng: vi.fn().mockReturnThis(),
            addTo: vi.fn().mockReturnThis(),
            getElement: () => popupElement
        } as any;
        const featureLatLng = new L.LatLng(5, 5);
        const map = {
            getSize: () => ({ x: 400, y: 300 }),
            latLngToContainerPoint: () => new L.Point(390, 290),
            containerPointToLatLng: (point: L.Point) => point
        } as any;

        addFeatureHoverPopup(map, popup, featureLatLng);

        expect(popup.setLatLng).toHaveBeenCalledTimes(2);
        expect(popup.setLatLng).toHaveBeenNthCalledWith(1, featureLatLng);
        expect(popup.setLatLng.mock.calls[1][0]).toMatchObject({ x: 338, y: 288 });
    });

    it('shifts an overlapping hover popup away from the legend', () => {
        const mapContainer = document.createElement('div');
        const legend = document.createElement('div');
        legend.classList.add('legend');
        mapContainer.appendChild(legend);
        Object.defineProperties(mapContainer, {
            getBoundingClientRect: {
                value: () => ({ left: 0, top: 0, right: 400, bottom: 300 })
            }
        });
        Object.defineProperties(legend, {
            getBoundingClientRect: {
                value: () => ({ left: 280, top: 0, right: 400, bottom: 100 })
            }
        });

        const popupElement = document.createElement('div');
        Object.defineProperties(popupElement, {
            offsetWidth: { value: 100 },
            offsetHeight: { value: 80 },
            getBoundingClientRect: {
                value: () => ({ left: 300, top: 20, right: 400, bottom: 100 })
            }
        });

        const popup = {
            setLatLng: vi.fn().mockReturnThis(),
            addTo: vi.fn().mockReturnThis(),
            getElement: () => popupElement
        } as any;
        const map = {
            getContainer: () => mapContainer,
            getSize: () => ({ x: 400, y: 300 }),
            latLngToContainerPoint: () => new L.Point(390, 100),
            containerPointToLatLng: (point: L.Point) => point
        } as any;

        addFeatureHoverPopup(map, popup, new L.LatLng(5, 5));

        expect(popup.setLatLng.mock.calls.at(-1)?.[0]).toMatchObject({ x: 218, y: 100 });
    });

    it('does not close a newer popup from a stale scheduled close', () => {
        vi.useFakeTimers();
        try {
            const firstPopup = {
                getElement: () => null,
                remove: vi.fn()
            } as unknown as L.Popup;
            const secondPopup = {
                getElement: () => null,
                remove: vi.fn()
            } as unknown as L.Popup;
            const controller = createFeatureHoverPopupController();

            controller.set(firstPopup);
            controller.scheduleClose();
            controller.set(secondPopup);
            vi.runAllTimers();

            expect(firstPopup.remove).not.toHaveBeenCalled();
            expect(secondPopup.remove).not.toHaveBeenCalled();
        } finally {
            vi.useRealTimers();
        }
    });

    it('disposes an active hover popup and cancels its scheduled close', () => {
        vi.useFakeTimers();
        try {
            const popup = {
                getElement: () => null,
                remove: vi.fn()
            } as unknown as L.Popup;
            const controller = createFeatureHoverPopupController();

            controller.set(popup);
            controller.scheduleClose();
            controller.dispose();
            vi.runAllTimers();

            expect(popup.remove).toHaveBeenCalledOnce();
            controller.dispose();
            expect(popup.remove).toHaveBeenCalledOnce();
        } finally {
            vi.useRealTimers();
        }
    });

    it('uses the initial hover point only when the feature centre is outside the viewport', () => {
        const featureCenter = new L.LatLng(5, 5);
        const initialHoverLatLng = new L.LatLng(6, 6);
        const visibleMap = {
            getBounds: () => new L.LatLngBounds(new L.LatLng(0, 0), new L.LatLng(10, 10))
        } as any;
        const offscreenMap = {
            getBounds: () => new L.LatLngBounds(new L.LatLng(0, 0), new L.LatLng(4, 4))
        } as any;

        expect(getFeatureHoverLatLng(visibleMap, featureCenter, initialHoverLatLng)).toBe(
            featureCenter
        );
        expect(getFeatureHoverLatLng(offscreenMap, featureCenter, initialHoverLatLng)).toBe(
            initialHoverLatLng
        );
    });

    it('closes hover popups without removing other map layers', () => {
        const hoverPopup = { options: { className: 'feature-popup-hover' } } as L.Popup;
        const clickPopup = { options: { className: 'feature-popup-description' } } as L.Popup;
        const map = {
            eachLayer: (callback: (layer: L.Layer) => void) => {
                callback(hoverPopup);
                callback(clickPopup);
            },
            removeLayer: vi.fn()
        } as unknown as L.Map;

        closeFeatureHoverPopups(map);

        expect(map.removeLayer).toHaveBeenCalledExactlyOnceWith(hoverPopup);
    });
});
