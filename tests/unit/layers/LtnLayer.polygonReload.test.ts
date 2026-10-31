/**
 * Unit tests for LtnLayer — tooltip recentring and drawing re-enable after reloads.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia } from 'pinia';

vi.mock('leaflet', () => import('../__mocks__/leaflet'));

import * as L from 'leaflet';
import { createLtnLayer } from '../../../src/composables/layers/useLtnLayer';
import { pinia } from '../../../src/stores/index';
import { useMapStore } from '../../../src/stores/mapStore';
import { makeMockMap, polygonFeatureCollection } from './LtnLayer.helpers';

describe('LtnLayer history payloads', () => {
    beforeEach(() => {
        setActivePinia(pinia);
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
