/**
 * Shared imported-layer fixture for the imported layer item unit tests.
 */
import type { ImportedGeoJsonLayer } from '../../src/models/ImportedGeoJsonLayer';

export function layer(id = 'wards'): ImportedGeoJsonLayer {
    return {
        id,
        name: 'Wards',
        nameProperty: 'name',
        featureCollection: {
            type: 'FeatureCollection',
            features: ['Alpha', 'Beta', 'Alpha', '', '  ', undefined].map((name) => ({
                type: 'Feature',
                properties: name === undefined ? null : { name },
                geometry: { type: 'Point', coordinates: [-1.9, 52.5] }
            }))
        }
    };
}
