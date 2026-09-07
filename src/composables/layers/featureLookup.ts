/**
 * featureLookup.ts
 *
 * Feature/history-id lookup helpers for layer composables.
 * Extracted from layerUtils.ts — pure mechanical split, no behavior changes.
 */
import * as L from 'leaflet';
import { findFeatureGroupMemberships } from '../../features/groups/featureMemberships';
import { getActiveVersion } from '../../features/groups/groupVersions';
import { useGroupStore } from '../../stores/groupStore';
import { useMapStore } from '../../stores/mapStore';
import { pinia } from '../../stores/index';
import type { GroupMember } from '../../models/Group';
import type { IMapLayer } from './IMapLayer';

/**
 * Read a feature's history id from a Leaflet layer, tolerating the two storage
 * conventions in use across the app:
 *   - Points and polylines attach a GeoJSON `feature`, so the id lives at
 *     `feature.properties.historyId`.
 *   - LTN polygons keep their metadata on a plain `properties` bag, so the id
 *     lives at `properties.historyId`.
 * Returns null when neither is present. Centralising this lookup avoids the
 * class of bugs where one call site checks only one location and silently
 * fails to identify polygons.
 */
export function getFeatureHistoryId(marker: unknown): string | null {
    const layer = marker as {
        feature?: { properties?: { historyId?: unknown } };
        properties?: { historyId?: unknown };
    } | null;
    const id = layer?.feature?.properties?.historyId ?? layer?.properties?.historyId;
    return typeof id === 'string' && id !== '' ? id : null;
}

const featureGroupIds = new WeakMap<Element, string | null>();

export function cacheFeatureGroupElement(element: Element | null, groupId: string | null): void {
    if (element) {
        featureGroupIds.set(element, groupId);
    }
}

export function findFeatureGroupIdByElement(element: Element): string | null {
    return featureGroupIds.get(element) ?? null;
}

export function findLayerFeatureByHistoryId(
    layers: IMapLayer[],
    layerId: string,
    historyId: string
): L.Layer | null {
    const layer = layers.find((item) => item.id === layerId)?.getLayer();
    let found: L.Layer | null = null;
    layer?.eachLayer((feature) => {
        if (getFeatureHistoryId(feature) === historyId) {
            found = feature;
        }
    });
    return found;
}

export function findFirstFeatureGroupId(member: GroupMember): string | null {
    return findFeatureGroupMemberships(useGroupStore(pinia).groups, member)[0]?.groupId ?? null;
}

export function getReadOnlyGroupCenter(groupId: string): L.LatLng | null {
    const groupStore = useGroupStore(pinia);
    const group = groupStore.groups.find((item) => item.id === groupId);
    if (!group) {
        return null;
    }

    const version = getActiveVersion(group, groupStore.activeVersionIds[groupId]);
    const bounds = L.latLngBounds([]);
    const layers = useMapStore(pinia).layers;
    for (const member of version.members) {
        const feature = findLayerFeatureByHistoryId(layers, member.layerId, member.historyId) as
            | (L.Layer & {
                  getBounds?: () => L.LatLngBounds;
                  getLatLng?: () => L.LatLng;
              })
            | null;
        if (!feature) {
            continue;
        }
        if (typeof feature.getBounds === 'function') {
            bounds.extend(feature.getBounds());
        } else if (typeof feature.getLatLng === 'function') {
            bounds.extend(feature.getLatLng());
        }
    }

    return bounds.isValid() ? bounds.getCenter() : null;
}

export function buildHistoryId(prefix: string): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
