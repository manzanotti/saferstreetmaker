/**
 * Unit tests for LtnLayer (polygon layer).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('leaflet', () => import('../__mocks__/leaflet'));
vi.mock('pubsub-js', () => ({
    default: { subscribe: vi.fn(), publish: vi.fn() },
}));

import { LtnLayer } from '../../../src/scripts/layers/LtnLayer';

function polygonFeatureCollection(polygons: [number, number][][][]) {
    return {
        features: polygons.map((rings) => ({
            geometry: { type: 'Polygon', coordinates: rings },
            properties: { label: 'LTN 1', color: '#cc00cc' },
        })),
    };
}

describe('LtnLayer', () => {
    let layer: LtnLayer;

    beforeEach(() => {
        layer = new LtnLayer();
    });

    it('has correct static Id', () => {
        expect(LtnLayer.Id).toBe('LtnCells');
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
                    [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
                ]) as any
            );
            expect(addLayerSpy).toHaveBeenCalledTimes(1);
        });

        it('loads multiple polygon features', () => {
            const addLayerSpy = vi.spyOn(layer.getLayer(), 'addLayer');
            layer.loadFromGeoJSON(
                polygonFeatureCollection([
                    [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
                    [[[2, 2], [3, 2], [3, 3], [2, 3], [2, 2]]],
                ]) as any
            );
            expect(addLayerSpy).toHaveBeenCalledTimes(2);
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
