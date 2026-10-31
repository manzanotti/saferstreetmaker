/**
 * Unit tests for imported GeoJSON property helpers and sanitizeImportedLayers.
 */
import { describe, expect, it, vi } from 'vitest';
import {
    deriveLayerName,
    formatPropertyValue,
    getNamePropertyOptions,
    getPropertyPreview,
    retainNameProperty,
    sanitizeImportedLayers
} from '../../src/features/map/importedGeoJson';
import { featureCollection } from './importedGeoJson.helpers';

describe('imported GeoJSON helpers', () => {
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

    it('drops malformed metadata and duplicate ids', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const result = sanitizeImportedLayers([
            validLayer,
            { ...validLayer, id: 'duplicate', name: 'Duplicate', nameProperty: null },
            { ...validLayer, id: 'duplicate', name: 'Duplicate 2', nameProperty: null },
            { id: '', name: 'Empty id', featureCollection },
            { id: 'bad-visibility', name: 'Bad visibility', visible: 'yes', featureCollection },
            { ...validLayer, id: 'other', nameProperty: 42 }
        ]);

        expect(result.map((layer) => layer.id)).toEqual(['valid', 'duplicate']);
        expect(warn).toHaveBeenCalledTimes(4);
        warn.mockRestore();
    });

    it('treats malformed imported-layer collections as empty', () => {
        expect(sanitizeImportedLayers({})).toEqual([]);
        expect(sanitizeImportedLayers(null)).toEqual([]);
    });
});
