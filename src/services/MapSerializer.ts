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

interface CompactSettings {
    t: string;
    r: 0 | 1;
    h: 0 | 1;
    a: string[];
    c: [number, number] | null;
    z: number;
    v: string;
}

export interface CompactStoredMap {
    s: CompactSettings;
    l: Record<string, unknown>;
    d: string;
}

export class MapSerializer {
    /** Convert the current map state to a plain JSON-serialisable object. */
    toJSON(settings: Settings, layersData: Map<string, IMapLayer>): SerializedMap {
        const layers: Record<string, unknown> = {};
        layersData.forEach((layer, layerName) => {
            layers[layerName] = layer.toGeoJSON();
        });
        return {
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
    }

    /**
     * Serialise the map state to a URI-encoded LZ-string hash suitable for use
     * as a URL fragment or iframe `src` parameter.
     */
    toEncodedHash(settings: Settings, layersData: Map<string, IMapLayer>): string {
        const mapString = JSON.stringify(this.toJSON(settings, layersData));
        return LZString.compressToEncodedURIComponent(mapString);
    }

    toCompactStoredMap(settings: Settings, layersData: Map<string, IMapLayer>): CompactStoredMap {
        const layers: Record<string, unknown> = {};
        layersData.forEach((layer, layerName) => {
            layers[layerName] = layer.toGeoJSON();
        });

        return {
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
    }

    fromCompactStoredMap(data: CompactStoredMap): SerializedMap {
        return {
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

        return {
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
