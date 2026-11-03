import { describe, expect, it } from 'vitest';
import { parseGeoJson } from '../../src/features/map/importedGeoJson';
import { featureCollection } from './importedGeoJson.helpers';

describe('imported GeoJSON helpers', () => {
    it('validates and clones a FeatureCollection', () => {
        const parsed = parseGeoJson(featureCollection);
        expect(parsed).toEqual(featureCollection);
        expect(parsed).not.toBe(featureCollection);
    });

    it('accepts features with null geometry', () => {
        const parsed = parseGeoJson({
            type: 'FeatureCollection',
            features: [
                { type: 'Feature', properties: { name: 'Unknown' }, geometry: null },
                featureCollection.features[0]
            ]
        });

        expect(parsed.features).toHaveLength(2);
        expect(parsed.features[0].geometry).toBeNull();
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

    it.each([
        { type: 'MultiPoint', coordinates: [] },
        { type: 'MultiLineString', coordinates: [[[-1.82, 52.44]]] },
        {
            type: 'Polygon',
            coordinates: [
                [
                    [-1.82, 52.44],
                    [-1.8, 52.44],
                    [-1.8, 52.46],
                    [-1.82, 52.46]
                ]
            ]
        },
        {
            type: 'MultiPolygon',
            coordinates: [
                [
                    [
                        [-1.82, 52.44],
                        [-1.8, 52.44],
                        [-1.8, 52.46],
                        [-1.82, 52.46]
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
