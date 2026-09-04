import { describe, expect, it } from 'vitest';
import {
    shouldReducePointFeatureSize,
    shouldShowPointFeatures
} from '../../src/features/map/pointFeatureVisibility';

function mapAtZoom(zoom: number) {
    return {
        getZoom: () => zoom,
        getMaxZoom: () => 20
    };
}

describe('point feature zoom visibility', () => {
    it('hides points at eight levels below maximum zoom', () => {
        expect(shouldShowPointFeatures(mapAtZoom(12))).toBe(false);
        expect(shouldShowPointFeatures(mapAtZoom(13))).toBe(true);
    });

    it('reduces point size by half at four levels below maximum zoom', () => {
        expect(shouldReducePointFeatureSize(mapAtZoom(16))).toBe(true);
        expect(shouldReducePointFeatureSize(mapAtZoom(15))).toBe(true);
        expect(shouldReducePointFeatureSize(mapAtZoom(13))).toBe(true);
        expect(shouldReducePointFeatureSize(mapAtZoom(17))).toBe(false);
    });
});
