import type { IMapLayer } from '../../composables/layers/IMapLayer';
import { isLinearRing, isPosition, isPositionArray } from './geoJsonCoordinates';

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function parseStoredLayerGeoJson(
    value: unknown,
    layerId: string,
    kind: IMapLayer['kind']
): GeoJSON.FeatureCollection {
    if (
        !isRecord(value) ||
        (value.type !== undefined && value.type !== 'FeatureCollection') ||
        !Array.isArray(value.features)
    ) {
        throw new Error(`Layer "${layerId}" must contain a GeoJSON feature collection.`);
    }

    const expectedType = {
        point: 'Point',
        polyline: 'LineString',
        polygon: 'Polygon'
    }[kind];

    const features = value.features.map((feature: unknown, index: number): GeoJSON.Feature => {
        const label = `Layer "${layerId}", feature ${index + 1}`;
        if (
            !isRecord(feature) ||
            (feature.type !== undefined && feature.type !== 'Feature') ||
            !isRecord(feature.geometry)
        ) {
            throw new Error(`${label} has an invalid ${expectedType} geometry.`);
        }

        const legacyMultiLine = kind === 'polyline' && feature.geometry.type === 'MultiLineString';
        if (
            feature.geometry.type !== undefined &&
            feature.geometry.type !== expectedType &&
            !legacyMultiLine
        ) {
            throw new Error(`${label} has an invalid ${expectedType} geometry.`);
        }

        const properties = feature.properties;
        if (properties !== undefined && properties !== null && !isRecord(properties)) {
            throw new Error(`${label} has invalid properties.`);
        }

        const coordinates = feature.geometry.coordinates;
        let geometry: GeoJSON.Point | GeoJSON.LineString | GeoJSON.Polygon;
        if (kind === 'point') {
            if (!isPosition(coordinates)) {
                throw new Error(`${label} has invalid coordinates.`);
            }
            geometry = { ...feature.geometry, type: 'Point', coordinates };
        } else if (kind === 'polyline') {
            // Older maps wrapped each line's coordinates in one extra array.
            const nestedLine =
                Array.isArray(coordinates) &&
                coordinates.length === 1 &&
                isPositionArray(coordinates[0], 2);
            if (legacyMultiLine && !nestedLine) {
                throw new Error(`${label} has invalid coordinates.`);
            }
            const line = nestedLine ? coordinates[0] : coordinates;
            if (!isPositionArray(line, 2)) {
                throw new Error(`${label} has invalid coordinates.`);
            }
            geometry = { ...feature.geometry, type: 'LineString', coordinates: line };
        } else {
            if (
                !Array.isArray(coordinates) ||
                coordinates.length === 0 ||
                !coordinates.every(isLinearRing)
            ) {
                throw new Error(`${label} has invalid coordinates.`);
            }
            geometry = { ...feature.geometry, type: 'Polygon', coordinates };
        }

        return {
            ...feature,
            type: 'Feature',
            geometry,
            properties: properties ?? null
        };
    });

    return { ...value, type: 'FeatureCollection', features };
}
