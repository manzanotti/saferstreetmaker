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
}

export class MapSerializer {
    /** Convert the current map state to a plain JSON-serialisable object. */
    toJSON(settings: Settings, layersData: Map<string, IMapLayer>): SerializedMap {
        const layers: Record<string, unknown> = {};
        layersData.forEach((layer, layerName) => {
            layers[layerName] = layer.toGeoJSON();
        });
        return {
            settings,
            layers,
            lastSaved: new Date().toISOString()
        };
    }

    /**
     * Serialise the map state to a URI-encoded LZ-string hash suitable for use
     * as a URL fragment or iframe `src` parameter.
     */
    toEncodedHash(settings: Settings, layersData: Map<string, IMapLayer>): string {
        const mapString = JSON.stringify(this.toJSON(settings, layersData));
        return LZString.compressToEncodedURIComponent(mapString);
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
