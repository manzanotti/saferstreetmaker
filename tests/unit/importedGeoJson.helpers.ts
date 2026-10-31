/**
 * Shared FeatureCollection fixture for the imported GeoJSON unit tests.
 */

export const featureCollection: GeoJSON.FeatureCollection = {
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
