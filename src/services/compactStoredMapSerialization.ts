import type { IMapLayer } from '../composables/layers/IMapLayer';
import type { Settings } from '../models/Settings';
import type { Group } from '../models/Group';
import type {
    ImportedGeoJsonLayer,
    SerializedImportedGeoJsonLayer
} from '../models/ImportedGeoJsonLayer';
import { retainNameProperty } from '../features/map/importedGeoJson';
import {
    deserializeCompactGroups,
    serializeCompactGroups,
    type CompactGroup
} from './compactGroupSerialization';
import type { SerializedMap } from './MapSerializer';

export interface CompactSettings {
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
    /** Compact groups — present only when at least one group exists. */
    g?: CompactGroup[];
    o?: SerializedImportedGeoJsonLayer[];
}

export function serializeImportedLayer(
    layer: ImportedGeoJsonLayer
): SerializedImportedGeoJsonLayer {
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

export function toCompactStoredMap(
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

export function fromCompactStoredMap(data: CompactStoredMap): SerializedMap {
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

export function toCompactStoredMapFromSerialized(
    data: SerializedMap,
    fallbackTitle = ''
): CompactStoredMap {
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

    const result: CompactStoredMap = {
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
        result.g = serializeCompactGroups(data.groups);
    }
    if (data.importedLayers && data.importedLayers.length > 0) {
        result.o = data.importedLayers;
    }
    return result;
}
