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
import type { Group, GroupPhase, GroupVersion } from '../models/Group';
import { normalizeGroupDescription } from '../features/groups/groupDescription';

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

/** Compact serialisation of a Group (short keys to minimise URL hash length). */
interface CompactGroup {
    i: string;
    n: string;
    c?: string;
    m?: Array<[string, string]>;
    d?: string;
    p?: string;
    v?: Array<{
        i: string;
        n: string;
        m: Array<[string, string]>;
        p?: Array<{ i: string; m: Array<[string, string]> }>;
    }>;
}

function serializeMembers(members: GroupVersion['members']): Array<[string, string]> {
    return members.map((member) => [member.layerId, member.historyId]);
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

function deserializeCompactMembers(members: Array<[string, string]> | undefined) {
    return (members ?? []).map(([layerId, historyId]) => ({ layerId, historyId }));
}

export interface CompactStoredMap {
    s: CompactSettings;
    l: Record<string, unknown>;
    d: string;
    /** Compact groups — present only when at least one group exists. */
    g?: CompactGroup[];
}

export class MapSerializer {
    /** Convert the current map state to a plain JSON-serialisable object. */
    toJSON(
        settings: Settings,
        layersData: Map<string, IMapLayer>,
        groups?: Group[]
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
        return result;
    }

    /**
     * Serialise the map state to a URI-encoded LZ-string hash suitable for use
     * as a URL fragment or iframe `src` parameter.
     */
    toEncodedHash(
        settings: Settings,
        layersData: Map<string, IMapLayer>,
        groups?: Group[]
    ): string {
        const mapString = JSON.stringify(this.toJSON(settings, layersData, groups));
        return LZString.compressToEncodedURIComponent(mapString);
    }

    toCompactStoredMap(
        settings: Settings,
        layersData: Map<string, IMapLayer>,
        groups?: Group[]
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
            result.g = groups.map((group) => {
                const description = normalizeGroupDescription(group.description);
                if (!group.versions) {
                    return {
                        i: group.id,
                        n: group.name,
                        ...(description ? { p: description } : {}),
                        ...(group.color ? { c: group.color } : {}),
                        m: serializeMembers(group.members ?? [])
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
                        m: serializeMembers(version.members),
                        ...(version.phases && version.phases.length > 0
                            ? {
                                  p: version.phases.map((phase) => ({
                                      i: phase.id,
                                      m: serializeMembers(phase.members)
                                  }))
                              }
                            : {})
                    }))
                };
            });
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
        if (data.g && data.g.length > 0) {
            result.groups = data.g.map((group) =>
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
                              members: deserializeCompactMembers(version.m),
                              ...(version.p
                                  ? {
                                        phases: version.p.map((phase) => ({
                                            id: phase.i,
                                            members: deserializeCompactMembers(phase.m)
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
                          members: deserializeCompactMembers(group.m)
                      }
            );
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
            fromSerializedResult.g = data.groups.map((group) => {
                const description = normalizeGroupDescription(group.description);
                if (!group.versions) {
                    return {
                        i: group.id,
                        n: group.name,
                        ...(description ? { p: description } : {}),
                        ...(group.color ? { c: group.color } : {}),
                        m: serializeMembers(group.members ?? [])
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
                        m: serializeMembers(version.members),
                        ...(version.phases && version.phases.length > 0
                            ? {
                                  p: version.phases.map((phase) => ({
                                      i: phase.id,
                                      m: serializeMembers(phase.members)
                                  }))
                              }
                            : {})
                    }))
                };
            });
        }
        return fromSerializedResult;
    }

    /**
     * Deserialise a hash (produced by `toEncodedHash`) back to a SerializedMap.
     * Returns `null` if the hash is invalid, malformed, or cannot be parsed.
     */
    fromEncodedHash(hash: string): SerializedMap | null {
        try {
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
}
