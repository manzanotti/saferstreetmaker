import type {
    ImportedGeoJsonLayer,
    SerializedImportedGeoJsonLayer
} from '../../models/ImportedGeoJsonLayer';

export interface GeoJsonPropertyPreview {
    key: string;
    value: unknown;
    displayValue: string;
    selectableAsName: boolean;
}

const supportedGeometryTypes = new Set([
    'Point',
    'MultiPoint',
    'LineString',
    'MultiLineString',
    'Polygon',
    'MultiPolygon',
    'GeometryCollection'
]);

function isPosition(value: unknown): value is number[] {
    return (
        Array.isArray(value) &&
        value.length >= 2 &&
        value.every((coordinate) => typeof coordinate === 'number' && Number.isFinite(coordinate))
    );
}

function isPositionArray(value: unknown, minimumLength: number): value is number[][] {
    return Array.isArray(value) && value.length >= minimumLength && value.every(isPosition);
}

function validateGeometry(geometry: unknown, featureIndex: number): void {
    if (!geometry || typeof geometry !== 'object') {
        throw new Error(`Feature ${featureIndex + 1} is missing a valid geometry.`);
    }
    const candidate = geometry as { type?: unknown; coordinates?: unknown; geometries?: unknown };
    if (typeof candidate.type !== 'string' || !supportedGeometryTypes.has(candidate.type)) {
        throw new Error(`Feature ${featureIndex + 1} uses an unsupported geometry type.`);
    }
    if (candidate.type === 'GeometryCollection') {
        if (!Array.isArray(candidate.geometries) || candidate.geometries.length === 0) {
            throw new Error(`Feature ${featureIndex + 1} has an invalid GeometryCollection.`);
        }
        candidate.geometries.forEach((item) => validateGeometry(item, featureIndex));
        return;
    }

    const valid =
        candidate.type === 'Point'
            ? isPosition(candidate.coordinates)
            : candidate.type === 'MultiPoint' || candidate.type === 'LineString'
              ? isPositionArray(candidate.coordinates, candidate.type === 'LineString' ? 2 : 1)
              : candidate.type === 'MultiLineString'
                ? Array.isArray(candidate.coordinates) &&
                  candidate.coordinates.length > 0 &&
                  candidate.coordinates.every((line) => isPositionArray(line, 2))
                : candidate.type === 'Polygon'
                  ? Array.isArray(candidate.coordinates) &&
                    candidate.coordinates.length > 0 &&
                    candidate.coordinates.every((ring) => isPositionArray(ring, 4))
                  : candidate.type === 'MultiPolygon'
                    ? Array.isArray(candidate.coordinates) &&
                      candidate.coordinates.length > 0 &&
                      candidate.coordinates.every(
                          (polygon) =>
                              Array.isArray(polygon) &&
                              polygon.length > 0 &&
                              polygon.every((ring) => isPositionArray(ring, 4))
                      )
                    : false;
    if (!valid) {
        throw new Error(`Feature ${featureIndex + 1} has invalid coordinates.`);
    }
}

export function parseGeoJson(value: unknown): GeoJSON.FeatureCollection {
    if (!value || typeof value !== 'object') {
        throw new Error('The file does not contain a JSON object.');
    }

    const candidate = value as { type?: unknown; features?: unknown };
    if (candidate.type !== 'FeatureCollection' || !Array.isArray(candidate.features)) {
        throw new Error('GeoJSON must contain a FeatureCollection with a features array.');
    }

    candidate.features.forEach((feature, index) => {
        if (!feature || typeof feature !== 'object') {
            throw new Error(`Feature ${index + 1} is not a JSON object.`);
        }
        const item = feature as { type?: unknown; geometry?: unknown; properties?: unknown };
        if (item.type !== 'Feature' || !item.geometry || typeof item.geometry !== 'object') {
            throw new Error(`Feature ${index + 1} is missing a valid geometry.`);
        }
        validateGeometry(item.geometry, index);
        if (
            item.properties !== null &&
            (typeof item.properties !== 'object' || Array.isArray(item.properties))
        ) {
            throw new Error(`Feature ${index + 1} has invalid properties.`);
        }
    });

    return structuredClone(value) as GeoJSON.FeatureCollection;
}

export function getPropertyPreview(
    featureCollection: GeoJSON.FeatureCollection
): GeoJsonPropertyPreview[] {
    const properties = featureCollection.features[0]?.properties;
    if (!properties || typeof properties !== 'object') {
        return [];
    }

    return Object.entries(properties).map(([key, value]) => ({
        key,
        value,
        displayValue: formatPropertyValue(value),
        selectableAsName: typeof value === 'string'
    }));
}

export function formatPropertyValue(value: unknown): string {
    if (typeof value === 'string') {
        return value;
    }
    if (value === null || value === undefined) {
        return '';
    }
    if (typeof value === 'object') {
        return JSON.stringify(value);
    }
    return String(value);
}

export function retainNameProperty(
    featureCollection: GeoJSON.FeatureCollection,
    nameProperty: string | null
): GeoJSON.FeatureCollection {
    return {
        type: 'FeatureCollection',
        features: featureCollection.features.map((feature) => ({
            type: 'Feature',
            id: feature.id,
            geometry: structuredClone(feature.geometry),
            properties:
                nameProperty && feature.properties && nameProperty in feature.properties
                    ? { [nameProperty]: feature.properties[nameProperty] }
                    : null
        }))
    };
}

export function deriveLayerName(sourceName: string, existingNames: string[] = []): string {
    const withoutExtension =
        sourceName
            .split(/[\\/]/)
            .pop()
            ?.replace(/\.(geojson|json)$/i, '') ?? '';
    const baseName = withoutExtension.trim() || 'GeoJSON layer';
    let candidate = baseName;
    let suffix = 2;
    while (existingNames.includes(candidate)) {
        candidate = `${baseName} (${suffix})`;
        suffix += 1;
    }
    return candidate;
}

export function cloneImportedLayers(
    layers: ImportedGeoJsonLayer[] | SerializedImportedGeoJsonLayer[]
): ImportedGeoJsonLayer[] {
    return layers.map((layer) => ({
        id: layer.id,
        name: layer.name,
        nameProperty: layer.nameProperty,
        visible: layer.visible !== false,
        featureCollection: structuredClone(layer.featureCollection)
    }));
}

export function createImportedLayer(
    sourceName: string,
    featureCollection: GeoJSON.FeatureCollection,
    existingNames: string[] = []
): ImportedGeoJsonLayer {
    return {
        id: crypto.randomUUID(),
        name: deriveLayerName(sourceName, existingNames),
        nameProperty: null,
        visible: true,
        featureCollection: structuredClone(featureCollection)
    };
}
