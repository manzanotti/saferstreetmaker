/**
 * Compact URL map encoding.
 *
 * Orchestrates the compact URL schema (v2) used for shareable hashes by
 * combining the lower-level compact encoders, and decodes every historical
 * hash format (v2 compact, legacy URI-encoded JSON, legacy LZ-string JSON).
 */
import LZString from 'lz-string';
import type { IMapLayer } from '../composables/layers/IMapLayer';
import type { Settings } from '../models/Settings';
import type { Group, GroupMember } from '../models/Group';
import type { ImportedGeoJsonLayer } from '../models/ImportedGeoJsonLayer';
import type { SerializedMap } from './MapSerializer';
import { decodeUrlGroups, encodeUrlGroups, type CompactUrlGroup } from './compactUrlGroups';
import type { CompactSettings } from './compactStoredMapSerialization';
import {
    COORDINATE_PRECISION,
    decodeCoordinates,
    decodeImportedLayers,
    decodeUrlProperties,
    encodeCoordinates,
    encodeImportedLayers,
    encodeUrlProperties,
    geometryTypeFromCoordinates,
    quantizeCoordinate,
    type CompactUrlFeature,
    type CompactUrlImportedLayer
} from './compactUrlEncoding';

export const URL_SCHEMA_VERSION = 2;
const URL_HASH_PREFIX = 'v2.';

export interface CompactUrlMap {
    v: 2;
    s: CompactSettings;
    i: string[];
    l: Record<string, CompactUrlFeature[]>;
    d: string;
    g?: CompactUrlGroup[];
    o?: CompactUrlImportedLayer[];
}

function createHistoryIndex(): {
    historyIds: string[];
    getHistoryIndex: (historyId: string) => number;
} {
    const historyIds: string[] = [];
    const historyIndexes = new Map<string, number>();
    const getHistoryIndex = (historyId: string): number => {
        const existing = historyIndexes.get(historyId);
        if (existing !== undefined) {
            return existing;
        }
        const index = historyIds.length;
        historyIds.push(historyId);
        historyIndexes.set(historyId, index);
        return index;
    };
    return { historyIds, getHistoryIndex };
}

function collectGroupHistoryIds(
    groups: Group[] | undefined,
    getHistoryIndex: (historyId: string) => number
): void {
    const collect = (members: GroupMember[]) => {
        members.forEach((member) => getHistoryIndex(member.historyId));
    };
    groups?.forEach((group) => {
        collect(group.unassignedMembers ?? []);
        if (group.versions) {
            group.versions.forEach((version) => {
                collect(version.members);
                version.phases?.forEach((phase) => collect(phase.members));
            });
        } else {
            collect(group.members ?? []);
        }
    });
}

export function toCompactUrlMap(
    settings: Settings,
    layersData: Map<string, IMapLayer>,
    groups?: Group[],
    importedLayers?: ImportedGeoJsonLayer[]
): CompactUrlMap {
    const { historyIds, getHistoryIndex } = createHistoryIndex();

    const layerFeatures = new Map<string, GeoJSON.Feature[]>();
    layersData.forEach((layer, layerName) => {
        const featureCollection = layer.toGeoJSON() as unknown as {
            features?: GeoJSON.Feature[];
        };
        const features = featureCollection.features ?? [];
        layerFeatures.set(layerName, features);
        features.forEach((feature) => {
            const historyId = feature.properties?.historyId;
            if (typeof historyId === 'string' && historyId !== '') {
                getHistoryIndex(historyId);
            }
        });
    });

    collectGroupHistoryIds(groups, getHistoryIndex);

    const layers: Record<string, CompactUrlFeature[]> = {};
    layerFeatures.forEach((features, layerName) => {
        layers[layerName] = features.map((feature) => {
            const state = { x: 0, y: 0 };
            const geometryCoordinates =
                'coordinates' in feature.geometry ? feature.geometry.coordinates : [];
            const coordinates = encodeCoordinates(geometryCoordinates, state);
            const properties = encodeUrlProperties(feature.properties, getHistoryIndex);
            return properties === undefined ? [coordinates] : [coordinates, properties];
        });
    });

    return {
        v: URL_SCHEMA_VERSION,
        s: {
            t: settings.title,
            r: settings.readOnly ? 1 : 0,
            h: settings.hideToolbar ? 1 : 0,
            a: [...settings.activeLayers],
            c: settings.centre
                ? ([settings.centre.lat, settings.centre.lng].map(quantizeCoordinate) as [
                      number,
                      number
                  ])
                : null,
            z: settings.zoom,
            v: settings.version
        },
        i: historyIds,
        l: layers,
        d: new Date().toISOString(),
        g: encodeUrlGroups(groups, getHistoryIndex),
        ...(importedLayers && importedLayers.length > 0
            ? { o: encodeImportedLayers(importedLayers) }
            : {})
    };
}

export function fromCompactUrlMap(data: CompactUrlMap): SerializedMap | null {
    if (data.v !== 2 || !data.s || !data.l || !Array.isArray(data.i)) {
        return null;
    }
    const layers: Record<string, unknown> = {};
    for (const [layerName, features] of Object.entries(data.l)) {
        layers[layerName] = {
            type: 'FeatureCollection',
            features: features.map(([coordinates, properties]) => {
                const state = { x: 0, y: 0 };
                const decodedCoordinates = decodeCoordinates(coordinates, state);
                return {
                    type: 'Feature',
                    properties: decodeUrlProperties(properties, data.i),
                    geometry: {
                        type: geometryTypeFromCoordinates(coordinates),
                        coordinates: decodedCoordinates
                    }
                };
            })
        };
    }
    return {
        settings: {
            title: data.s.t,
            readOnly: data.s.r === 1,
            hideToolbar: data.s.h === 1,
            activeLayers: [...data.s.a],
            centre: data.s.c
                ? {
                      lat: data.s.c[0] / COORDINATE_PRECISION,
                      lng: data.s.c[1] / COORDINATE_PRECISION
                  }
                : null,
            zoom: data.s.z,
            version: data.s.v
        },
        layers,
        lastSaved: data.d,
        groups: decodeUrlGroups(data.g, data.i),
        ...(data.o && data.o.length > 0 ? { importedLayers: decodeImportedLayers(data.o) } : {})
    };
}

/** Compress a compact URL map into a `v2.`-prefixed URI-safe hash. */
export function encodeCompactUrlHash(map: CompactUrlMap): string {
    return `${URL_HASH_PREFIX}${LZString.compressToEncodedURIComponent(JSON.stringify(map))}`;
}

/**
 * Decode any supported hash format back to a SerializedMap.
 * Returns `null` if the hash is invalid, malformed, or cannot be parsed.
 */
export function decodeMapHash(hash: string): SerializedMap | null {
    try {
        if (hash.startsWith(URL_HASH_PREFIX)) {
            const decompressed = LZString.decompressFromEncodedURIComponent(
                hash.slice(URL_HASH_PREFIX.length)
            );
            if (decompressed === null) {
                return null;
            }
            return fromCompactUrlMap(JSON.parse(decompressed));
        }
        if (hash.startsWith('%')) {
            return JSON.parse(decodeURIComponent(hash));
        }
        const decompressed = LZString.decompressFromEncodedURIComponent(hash);
        if (decompressed === null) {
            return null;
        }
        return JSON.parse(decompressed);
    } catch {
        return null;
    }
}
