import { describe, expect, it } from 'vitest';
import {
    deriveLayerName,
    formatPropertyValue,
    getPropertyPreview,
    parseGeoJson,
    retainNameProperty
} from '../../src/features/map/importedGeoJson';

const featureCollection: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: [
        {
            type: 'Feature',
            properties: {
                name: 'Acocks Green',
                count: 4,
                location: { lat: 52.44, lng: -1.82 }
            },
            geometry: {
                type: 'Point',
                coordinates: [-1.82, 52.44]
            }
        }
    ]
};

describe('imported GeoJSON helpers', () => {
    it('validates and clones a FeatureCollection', () => {
        const parsed = parseGeoJson(featureCollection);
        expect(parsed).toEqual(featureCollection);
        expect(parsed).not.toBe(featureCollection);
    });

    it('rejects non-FeatureCollection data', () => {
        expect(() => parseGeoJson({ type: 'Feature', geometry: null })).toThrow(
            'GeoJSON must contain a FeatureCollection with a features array.'
        );
    });

    it('previews all first-feature properties and only allows strings as names', () => {
        expect(getPropertyPreview(featureCollection)).toEqual([
            {
                key: 'name',
                value: 'Acocks Green',
                displayValue: 'Acocks Green',
                selectableAsName: true
            },
            { key: 'count', value: 4, displayValue: '4', selectableAsName: false },
            {
                key: 'location',
                value: { lat: 52.44, lng: -1.82 },
                displayValue: '{"lat":52.44,"lng":-1.82}',
                selectableAsName: false
            }
        ]);
    });

    it('derives unique source names', () => {
        expect(deriveLayerName('wards.geojson')).toBe('wards');
        expect(deriveLayerName('wards.geojson', ['wards'])).toBe('wards (2)');
    });

    it('formats complex values as text', () => {
        expect(formatPropertyValue(['a', 1])).toBe('["a",1]');
        expect(formatPropertyValue(null)).toBe('');
    });

    it('retains only the selected feature name property', () => {
        expect(retainNameProperty(featureCollection, 'name').features[0]?.properties).toEqual({
            name: 'Acocks Green'
        });
        expect(retainNameProperty(featureCollection, null).features[0]?.properties).toBeNull();
    });
});
