/**
 * MapSerializer
 *
 * Pure data-transformation helpers — no DOM, no localStorage, no side-effects.
 * Converts map data between:
 *   - in-memory (Settings + IMapLayer[]) representation
 *   - plain JSON object (used for storage / file download)
 *   - LZ-string-compressed URI-encoded hash (used for sharing)
 */
import LZString from 'lz-string';
import type { IMapLayer } from '../composables/layers/IMapLayer';
import type { Settings } from '../models/Settings';
import type { Group, GroupMember, GroupPhase } from '../models/Group';
import { normalizeGroupDescription } from '../features/groups/groupDescription';
import {
    deserializeCompactGroups,
    serializeCompactGroups,
    type CompactGroup
} from './compactGroupSerialization';
import type {
    ImportedGeoJsonLayer,
    SerializedImportedGeoJsonLayer
} from '../models/ImportedGeoJsonLayer';
import { retainNameProperty } from '../features/map/importedGeoJson';
import { decodeUrlGroups, encodeUrlGroups, type CompactUrlGroup } from './compactUrlGroups';
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
    type CompactUrlCoordinates,
    type CompactUrlFeature,
    type CompactUrlImportedLayer
} from './compactUrlEncoding';

/**
 * Typed shape of the JSON document produced by `MapSerializer.toJSON` and
 * consumed by `loadMapData` in `useMapManager.ts`.
 *
 * All fields are optional because the format has evolved over versions and
 * older documents may omit them — callers must guard before access.
 */
export interface SerializedMap {
    /** Current map title (legacy: stored at top level, superseded by settings.title) */
    title?: string;
    /** Full settings snapshot */
    settings?: {
        title: string;
        readOnly: boolean;
        hideToolbar: boolean;
        activeLayers: string[];
        centre: { lat: number; lng: number } | null;
        zoom: number;
        version: string;
    };
    /** GeoJSON FeatureCollections keyed by layer id */
    layers?: Record<string, unknown>;
    /** User-imported GeoJSON overlays. */
    importedLayers?: SerializedImportedGeoJsonLayer[];
    /**
     * Legacy top-level centre (stored directly before settings was introduced).
     * Only read when `settings` is absent.
     */
    centre?: { lat: number; lng: number };
    /** Legacy top-level zoom (same provenance as `centre`) */
    zoom?: number;
    /** ISO-8601 timestamp set by MapSerializer.toJSON */
    lastSaved?: string;
    /** Element groups — serialised alongside layer data. */
    groups?: Group[];
}

interface CompactSettings {
    t: string;
    r: 0 | 1;
    h: 0 | 1;
    a: string[];
    c: [number, number] | null;
    z: number;
    v: string;
}

const URL_SCHEMA_VERSION = 2;
interface CompactUrlMap {
    v: 2;
    s: CompactSettings;
    i: string[];
    l: Record<string, CompactUrlFeature[]>;
    d: string;
    g?: CompactUrlGroup[];
    o?: CompactUrlImportedLayer[];
}

function serializePhases(phases: GroupPhase[] | undefined): GroupPhase[] {
    return (phases ?? []).map((phase) => ({
        id: phase.id,
        members: phase.members.map((member) => ({ ...member }))
    }));
}

function serializeGroup(group: Group): Group {
    const description = normalizeGroupDescription(group.description);
    if (!group.versions) {
        return {
            id: group.id,
            name: group.name,
            ...(description ? { description } : {}),
            ...(group.color ? { color: group.color } : {}),
            members: (group.members ?? []).map((member) => ({ ...member }))
        };
    }
    return {
        id: group.id,
        name: group.name,
        ...(description ? { description } : {}),
        ...(group.color ? { color: group.color } : {}),
        defaultVersionId: group.defaultVersionId,
        versions: group.versions.map((version) => ({
            id: version.id,
            name: version.name,
            members: version.members.map((member) => ({ ...member })),
            ...(version.phases !== undefined ? { phases: serializePhases(version.phases) } : {})
        }))
    };
}

function serializeImportedLayer(layer: ImportedGeoJsonLayer): SerializedImportedGeoJsonLayer {
    return {
        id: layer.id,
        name: layer.name,
        nameProperty: layer.nameProperty,
        ...(layer.visible === false ? { visible: false } : {}),
        featureCollection: retainNameProperty(
            JSON.parse(JSON.stringify(layer.featureCollection)),
            layer.nameProperty
        )
    };
}

export interface CompactStoredMap {
    s: CompactSettings;
    l: Record<string, unknown>;
    d: string;
    /** Compact groups — present only when at least one group exists. */
    g?: CompactGroup[];
    o?: SerializedImportedGeoJsonLayer[];
}

export class MapSerializer {
    /** Convert the current map state to a plain JSON-serialisable object. */
    toJSON(
        settings: Settings,
        layersData: Map<string, IMapLayer>,
        groups?: Group[],
        importedLayers?: ImportedGeoJsonLayer[]
    ): SerializedMap {
        const layers: Record<string, unknown> = {};
        layersData.forEach((layer, layerName) => {
            layers[layerName] = layer.toGeoJSON();
        });
        const result: SerializedMap = {
            settings: {
                title: settings.title,
                readOnly: settings.readOnly,
                hideToolbar: settings.hideToolbar,
                activeLayers: [...settings.activeLayers],
                centre: settings.centre
                    ? { lat: settings.centre.lat, lng: settings.centre.lng }
                    : null,
                zoom: settings.zoom,
                version: settings.version
            },
            layers,
            lastSaved: new Date().toISOString()
        };
        if (groups && groups.length > 0) {
            // Explicitly create plain objects to avoid IndexedDB DataCloneError
            // when groups are read from a Vue reactive Proxy.
            result.groups = groups.map(serializeGroup);
        }
        if (importedLayers && importedLayers.length > 0) {
            result.importedLayers = importedLayers.map(serializeImportedLayer);
        }
        return result;
    }

    /**
     * Serialise the map state to a URI-encoded LZ-string hash suitable for use
     * as a URL fragment or iframe `src` parameter.
     */
    toEncodedHash(
        settings: Settings,
        layersData: Map<string, IMapLayer>,
        groups?: Group[],
        importedLayers?: ImportedGeoJsonLayer[]
    ): string {
        const mapString = JSON.stringify(
            this.toCompactUrlMap(settings, layersData, groups, importedLayers)
        );
        return `v2.${LZString.compressToEncodedURIComponent(mapString)}`;
    }

    toCompactStoredMap(
        settings: Settings,
        layersData: Map<string, IMapLayer>,
        groups?: Group[],
        importedLayers?: ImportedGeoJsonLayer[]
    ): CompactStoredMap {
        const layers: Record<string, unknown> = {};
        layersData.forEach((layer, layerName) => {
            layers[layerName] = layer.toGeoJSON();
        });

        const result: CompactStoredMap = {
            s: {
                t: settings.title,
                r: settings.readOnly ? 1 : 0,
                h: settings.hideToolbar ? 1 : 0,
                a: [...settings.activeLayers],
                c: settings.centre ? [settings.centre.lat, settings.centre.lng] : null,
                z: settings.zoom,
                v: settings.version
            },
            l: layers,
            d: new Date().toISOString()
        };
        if (groups && groups.length > 0) {
            result.g = serializeCompactGroups(groups);
        }
        if (importedLayers && importedLayers.length > 0) {
            result.o = importedLayers.map(serializeImportedLayer);
        }
        return result;
    }

    fromCompactStoredMap(data: CompactStoredMap): SerializedMap {
        const result: SerializedMap = {
            settings: {
                title: data.s.t,
                readOnly: data.s.r === 1,
                hideToolbar: data.s.h === 1,
                activeLayers: [...data.s.a],
                centre: data.s.c ? { lat: data.s.c[0], lng: data.s.c[1] } : null,
                zoom: data.s.z,
                version: data.s.v
            },
            layers: data.l,
            lastSaved: data.d
        };
        const groups = deserializeCompactGroups(data.g);
        if (groups) {
            result.groups = groups;
        }
        if (data.o && data.o.length > 0) {
            result.importedLayers = data.o;
        }
        return result;
    }

    toCompactStoredMapFromSerialized(data: SerializedMap, fallbackTitle = ''): CompactStoredMap {
        const settings = data.settings;

        if (!settings) {
            return {
                s: {
                    t: data.title ?? fallbackTitle,
                    r: 0,
                    h: 0,
                    a: Object.keys(data.layers ?? {}),
                    c: data.centre ? [data.centre.lat, data.centre.lng] : null,
                    z: data.zoom ?? 0,
                    v: ''
                },
                l: data.layers ?? {},
                d: data.lastSaved ?? new Date().toISOString()
            };
        }

        const fromSerializedResult: CompactStoredMap = {
            s: {
                t: settings.title,
                r: settings.readOnly ? 1 : 0,
                h: settings.hideToolbar ? 1 : 0,
                a: [...settings.activeLayers],
                c: settings.centre ? [settings.centre.lat, settings.centre.lng] : null,
                z: settings.zoom,
                v: settings.version ?? ''
            },
            l: data.layers ?? {},
            d: data.lastSaved ?? new Date().toISOString()
        };
        if (data.groups && data.groups.length > 0) {
            fromSerializedResult.g = serializeCompactGroups(data.groups);
        }
        if (data.importedLayers && data.importedLayers.length > 0) {
            fromSerializedResult.o = data.importedLayers;
        }
        return fromSerializedResult;
    }

    /**
     * Deserialise a hash (produced by `toEncodedHash`) back to a SerializedMap.
     * Returns `null` if the hash is invalid, malformed, or cannot be parsed.
     */
    fromEncodedHash(hash: string): SerializedMap | null {
        try {
            if (hash.startsWith('v2.')) {
                const decompressed = LZString.decompressFromEncodedURIComponent(hash.slice(3));
                if (decompressed === null) {
                    return null;
                }
                return this.fromCompactUrlMap(JSON.parse(decompressed));
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

    private toCompactUrlMap(
        settings: Settings,
        layersData: Map<string, IMapLayer>,
        groups?: Group[],
        importedLayers?: ImportedGeoJsonLayer[]
    ): CompactUrlMap {
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

        const collectGroupIds = (members: GroupMember[]) => {
            members.forEach((member) => getHistoryIndex(member.historyId));
        };
        groups?.forEach((group) => {
            if (group.versions) {
                group.versions.forEach((version) => {
                    collectGroupIds(version.members);
                    version.phases?.forEach((phase) => collectGroupIds(phase.members));
                });
            } else {
                collectGroupIds(group.members ?? []);
            }
        });

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

    private fromCompactUrlMap(data: CompactUrlMap): SerializedMap | null {
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
}
