/**
 * MapSerializer
 *
 * Pure data-transformation helpers — no DOM, no localStorage, no side-effects.
 * Converts map data between:
 *   - in-memory (Settings + IMapLayer[]) representation
 *   - plain JSON object (used for storage / file download)
 *   - LZ-string-compressed URI-encoded hash (used for sharing)
 */
import type { IMapLayer } from '../composables/layers/IMapLayer';
import type { Settings } from '../models/Settings';
import type { Group, GroupPhase } from '../models/Group';
import { normalizeGroupDescription } from '../features/groups/groupDescription';
import type {
    ImportedGeoJsonLayer,
    SerializedImportedGeoJsonLayer
} from '../models/ImportedGeoJsonLayer';
import {
    fromCompactStoredMap,
    serializeImportedLayer,
    toCompactStoredMap,
    toCompactStoredMapFromSerialized,
    type CompactStoredMap
} from './compactStoredMapSerialization';
import { decodeMapHash, encodeCompactUrlHash, toCompactUrlMap } from './compactUrlMap';

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
        ...(group.unassignedMembers?.length
            ? { unassignedMembers: group.unassignedMembers.map((member) => ({ ...member })) }
            : {}),
        versions: group.versions.map((version) => ({
            id: version.id,
            name: version.name,
            members: version.members.map((member) => ({ ...member })),
            ...(version.phases !== undefined ? { phases: serializePhases(version.phases) } : {})
        }))
    };
}

export type { CompactStoredMap } from './compactStoredMapSerialization';

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
        return encodeCompactUrlHash(toCompactUrlMap(settings, layersData, groups, importedLayers));
    }

    toCompactStoredMap(
        settings: Settings,
        layersData: Map<string, IMapLayer>,
        groups?: Group[],
        importedLayers?: ImportedGeoJsonLayer[]
    ): CompactStoredMap {
        return toCompactStoredMap(settings, layersData, groups, importedLayers);
    }

    fromCompactStoredMap(data: CompactStoredMap): SerializedMap {
        return fromCompactStoredMap(data);
    }

    toCompactStoredMapFromSerialized(data: SerializedMap, fallbackTitle = ''): CompactStoredMap {
        return toCompactStoredMapFromSerialized(data, fallbackTitle);
    }

    /**
     * Deserialise a hash (produced by `toEncodedHash`) back to a SerializedMap.
     * Returns `null` if the hash is invalid, malformed, or cannot be parsed.
     */
    fromEncodedHash(hash: string): SerializedMap | null {
        return decodeMapHash(hash);
    }
}
