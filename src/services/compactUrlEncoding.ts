/**
 * compactUrlEncoding
 *
 * Types and helpers for the ultra-compact URL-hash serialisation format
 * (`CompactUrlMap`, schema version 2) used by `MapSerializer.toEncodedHash` /
 * `fromEncodedHash`. Coordinates are quantised and delta-encoded to keep the
 * URL as short as possible.
 */
import type { Group, GroupMember, GroupVersion } from '../models/Group';
import { normalizeGroupDescription } from '../features/groups/groupDescription';
import type {
    ImportedGeoJsonLayer,
    SerializedImportedGeoJsonLayer
} from '../models/ImportedGeoJsonLayer';

export const COORDINATE_PRECISION = 1_000_000;

export type CompactUrlCoordinates = number[] | CompactUrlCoordinates[];
export type CompactUrlProperties = {
    h?: number;
    l?: string;
    c?: string;
    x?: Record<string, unknown>;
};
export type CompactUrlFeature = [CompactUrlCoordinates, CompactUrlProperties?];
export interface CompactUrlImportedGeometry {
    t: GeoJSON.Geometry['type'];
    c?: CompactUrlCoordinates;
    g?: CompactUrlImportedGeometry[];
}
export type CompactUrlImportedFeature =
    | [CompactUrlImportedGeometry, Record<string, unknown> | null | undefined]
    | [CompactUrlImportedGeometry, Record<string, unknown> | null | undefined, string | number];
export interface CompactUrlImportedLayer {
    i: string;
    n: string;
    p: string | null;
    v?: 0;
    f: CompactUrlImportedFeature[];
}

export interface CompactUrlGroup {
    i: string;
    n: string;
    c?: string;
    d?: string;
    p?: string;
    m?: Array<[string, number]>;
    v?: Array<{
        i: string;
        n: string;
        m: Array<[string, number]>;
        p?: Array<{ i: string; m: Array<[string, number]> }>;
    }>;
}

export interface CompactUrlMap {
    v: 2;
    s: {
        t: string;
        r: 0 | 1;
        h: 0 | 1;
        a: string[];
        c: [number, number] | null;
        z: number;
        v: string;
    };
    i: string[];
    l: Record<string, CompactUrlFeature[]>;
    d: string;
    g?: CompactUrlGroup[];
    o?: CompactUrlImportedLayer[];
}

export function quantizeCoordinate(value: number): number {
    return Math.round(value * COORDINATE_PRECISION);
}

export function isNumericCoordinateArray(value: CompactUrlCoordinates): value is number[] {
    return value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number';
}

export function encodeCoordinates(
    coordinates: unknown,
    state: { x: number; y: number }
): CompactUrlCoordinates {
    if (!Array.isArray(coordinates)) {
        return [];
    }
    if (isNumericCoordinateArray(coordinates)) {
        const x = quantizeCoordinate(coordinates[0]);
        const y = quantizeCoordinate(coordinates[1]);
        const encoded = [x - state.x, y - state.y];
        state.x = x;
        state.y = y;
        for (let index = 2; index < coordinates.length; index += 1) {
            const value = coordinates[index];
            if (typeof value === 'number') {
                encoded.push(quantizeCoordinate(value));
            }
        }
        return encoded;
    }
    return coordinates.map((value) => encodeCoordinates(value, state));
}

export function decodeCoordinates(
    coordinates: CompactUrlCoordinates,
    state: { x: number; y: number }
): CompactUrlCoordinates {
    if (isNumericCoordinateArray(coordinates)) {
        state.x += coordinates[0];
        state.y += coordinates[1];
        return [
            state.x / COORDINATE_PRECISION,
            state.y / COORDINATE_PRECISION,
            ...coordinates.slice(2).map((value) => value / COORDINATE_PRECISION)
        ];
    }
    return coordinates.map((value) => decodeCoordinates(value, state));
}

export function encodeImportedGeometry(
    geometry: GeoJSON.Geometry,
    state: { x: number; y: number }
): CompactUrlImportedGeometry {
    if (geometry.type === 'GeometryCollection') {
        return {
            t: geometry.type,
            g: geometry.geometries.map((child) => encodeImportedGeometry(child, state))
        };
    }
    return {
        t: geometry.type,
        c: encodeCoordinates(geometry.coordinates, state)
    };
}

export function decodeImportedGeometry(
    geometry: CompactUrlImportedGeometry,
    state: { x: number; y: number }
): GeoJSON.Geometry {
    if (geometry.t === 'GeometryCollection') {
        return {
            type: 'GeometryCollection',
            geometries: (geometry.g ?? []).map((child) => decodeImportedGeometry(child, state))
        };
    }
    return {
        type: geometry.t,
        coordinates: decodeCoordinates(geometry.c ?? [], state)
    } as GeoJSON.Geometry;
}

export function encodeImportedLayers(layers: ImportedGeoJsonLayer[]): CompactUrlImportedLayer[] {
    return layers.map((layer) => ({
        i: layer.id,
        n: layer.name,
        p: layer.nameProperty,
        ...(layer.visible === false ? { v: 0 as const } : {}),
        f: layer.featureCollection.features.map((feature) => {
            const state = { x: 0, y: 0 };
            const properties = feature.properties
                ? JSON.parse(JSON.stringify(feature.properties))
                : feature.properties;
            const encodedGeometry = encodeImportedGeometry(feature.geometry, state);
            return feature.id === undefined
                ? [encodedGeometry, properties]
                : [encodedGeometry, properties, feature.id];
        })
    }));
}

export function decodeImportedLayers(
    layers: CompactUrlImportedLayer[]
): SerializedImportedGeoJsonLayer[] {
    return layers.map((layer) => ({
        id: layer.i,
        name: layer.n,
        nameProperty: layer.p,
        ...(layer.v === 0 ? { visible: false } : {}),
        featureCollection: {
            type: 'FeatureCollection',
            features: layer.f.map(([geometry, properties, id]) => ({
                type: 'Feature',
                ...(id !== undefined ? { id } : {}),
                properties: properties ?? null,
                geometry: decodeImportedGeometry(geometry, { x: 0, y: 0 })
            }))
        }
    }));
}

export function encodeUrlProperties(
    properties: Record<string, unknown> | null | undefined,
    getHistoryIndex: (historyId: string) => number
): CompactUrlProperties | undefined {
    if (!properties || Object.keys(properties).length === 0) {
        return undefined;
    }
    const compact: CompactUrlProperties = {};
    const extra: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(properties)) {
        if (key === 'historyId' && typeof value === 'string') {
            compact.h = getHistoryIndex(value);
        } else if (key === 'label' && typeof value === 'string') {
            compact.l = value;
        } else if (key === 'color' && typeof value === 'string') {
            compact.c = value;
        } else {
            extra[key] = value;
        }
    }
    if (Object.keys(extra).length > 0) {
        compact.x = extra;
    }
    return compact;
}

export function decodeUrlProperties(
    properties: CompactUrlProperties | undefined,
    historyIds: string[]
): Record<string, unknown> {
    const result: Record<string, unknown> = { ...(properties?.x ?? {}) };
    if (properties?.h !== undefined && historyIds[properties.h] !== undefined) {
        result.historyId = historyIds[properties.h];
    }
    if (properties?.l !== undefined) {
        result.label = properties.l;
    }
    if (properties?.c !== undefined) {
        result.color = properties.c;
    }
    return result;
}

export function geometryTypeFromCoordinates(
    coordinates: CompactUrlCoordinates
): 'Point' | 'LineString' | 'Polygon' {
    if (isNumericCoordinateArray(coordinates)) {
        return 'Point';
    }
    if (Array.isArray(coordinates[0]) && typeof coordinates[0][0] === 'number') {
        return 'LineString';
    }
    return 'Polygon';
}

export function encodeUrlMembers(
    members: GroupVersion['members'],
    getHistoryIndex: (historyId: string) => number
): Array<[string, number]> {
    return members.map((member) => [member.layerId, getHistoryIndex(member.historyId)]);
}

export function decodeUrlMembers(
    members: Array<[string, number]> | undefined,
    historyIds: string[]
): GroupMember[] {
    return (members ?? [])
        .filter((member) => historyIds[member[1]] !== undefined)
        .map(([layerId, historyIndex]) => ({
            layerId,
            historyId: historyIds[historyIndex]
        }));
}

export function encodeUrlGroups(
    groups: Group[] | undefined,
    getHistoryIndex: (historyId: string) => number
): CompactUrlGroup[] | undefined {
    if (!groups || groups.length === 0) {
        return undefined;
    }
    return groups.map((group) => {
        const description = normalizeGroupDescription(group.description);
        if (!group.versions) {
            return {
                i: group.id,
                n: group.name,
                ...(description ? { p: description } : {}),
                ...(group.color ? { c: group.color } : {}),
                m: encodeUrlMembers(group.members ?? [], getHistoryIndex)
            };
        }
        return {
            i: group.id,
            n: group.name,
            ...(description ? { p: description } : {}),
            ...(group.color ? { c: group.color } : {}),
            d: group.defaultVersionId,
            v: group.versions.map((version) => ({
                i: version.id,
                n: version.name,
                m: encodeUrlMembers(version.members, getHistoryIndex),
                ...(version.phases && version.phases.length > 0
                    ? {
                          p: version.phases.map((phase) => ({
                              i: phase.id,
                              m: encodeUrlMembers(phase.members, getHistoryIndex)
                          }))
                      }
                    : {})
            }))
        };
    });
}

export function decodeUrlGroups(
    groups: CompactUrlGroup[] | undefined,
    historyIds: string[]
): Group[] | undefined {
    if (!groups || groups.length === 0) {
        return undefined;
    }
    return groups.map((group) =>
        group.v
            ? {
                  id: group.i,
                  name: group.n,
                  ...(group.p ? { description: group.p } : {}),
                  ...(group.c ? { color: group.c } : {}),
                  defaultVersionId: group.d,
                  versions: group.v.map((version) => ({
                      id: version.i,
                      name: version.n,
                      members: decodeUrlMembers(version.m, historyIds),
                      ...(version.p
                          ? {
                                phases: version.p.map((phase) => ({
                                    id: phase.i,
                                    members: decodeUrlMembers(phase.m, historyIds)
                                }))
                            }
                          : {})
                  }))
              }
            : {
                  id: group.i,
                  name: group.n,
                  ...(group.p ? { description: group.p } : {}),
                  ...(group.c ? { color: group.c } : {}),
                  members: decodeUrlMembers(group.m, historyIds)
              }
    );
}
