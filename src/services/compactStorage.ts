/**
 * compactStorage
 *
 * Types for the compact (short-key) representation used for localStorage /
 * file persistence via `MapSerializer.toCompactStoredMap` /
 * `fromCompactStoredMap`.
 */
import type { SerializedImportedGeoJsonLayer } from '../models/ImportedGeoJsonLayer';

export interface CompactSettings {
    t: string;
    r: 0 | 1;
    h: 0 | 1;
    a: string[];
    c: [number, number] | null;
    z: number;
    v: string;
}

/** Compact serialisation of a Group (short keys to minimise URL hash length). */
export interface CompactGroup {
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

export interface CompactStoredMap {
    s: CompactSettings;
    l: Record<string, unknown>;
    d: string;
    /** Compact groups — present only when at least one group exists. */
    g?: CompactGroup[];
    o?: SerializedImportedGeoJsonLayer[];
}
