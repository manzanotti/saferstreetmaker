import { describe, expect, it, vi } from 'vitest';
import {
    deriveLayerName,
    formatPropertyValue,
    getNamePropertyOptions,
    getPropertyPreview,
    parseGeoJson,
    retainNameProperty,
    sanitizeImportedLayers
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

    it.each([
        { type: 'Point', coordinates: [-1.82, Infinity] },
        { type: 'LineString', coordinates: [[-1.82, 52.44]] },
        { type: 'Polygon', coordinates: [[[-1.82, 52.44]]] },
        { type: 'GeometryCollection', geometries: [] }
    ])('rejects malformed $type geometry payloads', (geometry) => {
        expect(() =>
            parseGeoJson({
                type: 'FeatureCollection',
                features: [{ type: 'Feature', properties: null, geometry }]
            })
        ).toThrow();
    });

    it('rejects array feature properties', () => {
        expect(() =>
            parseGeoJson({
                type: 'FeatureCollection',
                features: [
                    {
                        type: 'Feature',
                        properties: [],
                        geometry: { type: 'Point', coordinates: [-1.82, 52.44] }
                    }
                ]
            })
        ).toThrow('Feature 1 has invalid properties.');
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

    it('finds string name fields across all features', () => {
        const collection: GeoJSON.FeatureCollection = {
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    properties: { code: 1, name: null },
                    geometry: { type: 'Point', coordinates: [-1.82, 52.44] }
                },
                {
                    type: 'Feature',
                    properties: { name: 'Acocks Green', ward: 'Acocks Green Ward' },
                    geometry: { type: 'Point', coordinates: [-1.83, 52.45] }
                }
            ]
        };

        expect(getNamePropertyOptions(collection)).toEqual(['name', 'ward']);
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

    it.each([
        { type: 'MultiPoint', coordinates: [] },
        { type: 'MultiLineString', coordinates: [[[-1.82, 52.44]]] },
        {
            type: 'MultiPolygon',
            coordinates: [
                [
                    [
                        [-1.82, 52.44],
                        [-1.8, 52.44],
                        [-1.8, 52.46]
                    ]
                ]
            ]
        }
    ])('rejects malformed $type geometry payloads', (geometry) => {
        expect(() =>
            parseGeoJson({
                type: 'FeatureCollection',
                features: [{ type: 'Feature', properties: null, geometry }]
            })
        ).toThrow('Feature 1 has invalid coordinates.');
    });

    it('rejects unsupported geometry types', () => {
        expect(() =>
            parseGeoJson({
                type: 'FeatureCollection',
                features: [
                    {
                        type: 'Feature',
                        properties: null,
                        geometry: { type: 'Circle', coordinates: [-1.82, 52.44] }
                    }
                ]
            })
        ).toThrow('Feature 1 uses an unsupported geometry type.');
    });

    it('rejects a GeometryCollection containing an invalid child geometry', () => {
        expect(() =>
            parseGeoJson({
                type: 'FeatureCollection',
                features: [
                    {
                        type: 'Feature',
                        properties: null,
                        geometry: {
                            type: 'GeometryCollection',
                            geometries: [{ type: 'LineString', coordinates: [[-1.82, 52.44]] }]
                        }
                    }
                ]
            })
        ).toThrow('Feature 1 has invalid coordinates.');
    });

    it('accepts valid multi-part and nested geometries', () => {
        const collection: GeoJSON.FeatureCollection = {
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    properties: null,
                    geometry: {
                        type: 'MultiPolygon',
                        coordinates: [
                            [
                                [
                                    [-1.82, 52.44],
                                    [-1.8, 52.44],
                                    [-1.8, 52.46],
                                    [-1.82, 52.44]
                                ]
                            ]
                        ]
                    }
                },
                {
                    type: 'Feature',
                    properties: null,
                    geometry: {
                        type: 'GeometryCollection',
                        geometries: [
                            { type: 'Point', coordinates: [-1.82, 52.44] },
                            {
                                type: 'LineString',
                                coordinates: [
                                    [-1.82, 52.44],
                                    [-1.8, 52.46]
                                ]
                            }
                        ]
                    }
                }
            ]
        };

        expect(parseGeoJson(collection)).toEqual(collection);
    });
});

describe('sanitizeImportedLayers', () => {
    const validLayer = {
        id: 'valid',
        name: 'Valid',
        nameProperty: 'name',
        featureCollection
    };

    it('returns an empty array when there is nothing to sanitize', () => {
        expect(sanitizeImportedLayers(undefined)).toEqual([]);
        expect(sanitizeImportedLayers([])).toEqual([]);
    });

    it('keeps valid layers and normalises visibility', () => {
        const [visible, hidden] = sanitizeImportedLayers([
            validLayer,
            { ...validLayer, id: 'hidden', visible: false }
        ]);

        expect(visible.visible).toBe(true);
        expect(hidden.visible).toBe(false);
        expect(visible.featureCollection).not.toBe(featureCollection);
    });

    it('drops layers whose GeoJSON no longer validates', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const result = sanitizeImportedLayers([
            validLayer,
            {
                id: 'broken',
                name: 'Broken',
                nameProperty: null,
                featureCollection: {
                    type: 'FeatureCollection',
                    features: [
                        {
                            type: 'Feature',
                            properties: null,
                            geometry: { type: 'LineString', coordinates: [[-1.82, 52.44]] }
                        }
                    ]
                } as unknown as GeoJSON.FeatureCollection
            }
        ]);

        expect(result.map((layer) => layer.id)).toEqual(['valid']);
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });
});
