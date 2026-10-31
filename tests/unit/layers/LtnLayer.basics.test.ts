/**
 * Unit tests for LtnLayer composable — identity, toolbar, legend and toGeoJSON().
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('leaflet', () => import('../__mocks__/leaflet'));

import * as L from 'leaflet';
import { createLtnLayer } from '../../../src/composables/layers/useLtnLayer';
import { makeMockMap } from './LtnLayer.helpers';

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

    describe('toGeoJSON()', () => {
        it('returns a FeatureCollection', () => {
            const json = layer.toGeoJSON() as any;
            expect(json.type).toBe('FeatureCollection');
            expect(Array.isArray(json.features)).toBe(true);
        });
    });
});
