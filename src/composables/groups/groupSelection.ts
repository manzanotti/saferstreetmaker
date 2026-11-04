import * as L from 'leaflet';
import type { SelectedMarker } from '../../stores/selectionStore';
import { useMapStore } from '../../stores/mapStore';
import { useSelectionStore } from '../../stores/selectionStore';
import { useGroupStore } from '../../stores/groupStore';
import { pinia } from '../../stores/index';
import { getActiveVersion, getGroupVersions } from '../../features/groups/groupVersions';
import { buildFeatureSelectionEntries, applySelectionHighlights } from '../useAreaSelection';
import { findMarkerByHistoryId, buildEntriesForMembers } from './groupRuntime';

export function selectGroup(id: string, highlightFeatures = true): void {
    const groupStore = useGroupStore(pinia);
    const mapStore = useMapStore(pinia);
    const selectionStore = useSelectionStore(pinia);

    const group = groupStore.groups.find((g) => g.id === id);
    const members = group ? getActiveVersion(group, groupStore.activeVersionIds[id]).members : [];
    if (!group) {
        return;
    }

    // Build SelectedMarker entries for every member, handling both point
    // markers (getLatLng) and polyline/polygon features (getLatLngs).
    const allEntries: SelectedMarker[] = [];

    for (const member of members) {
        const marker = findMarkerByHistoryId(member.layerId, member.historyId);
        if (!marker) {
            continue;
        }

        const isPoint = typeof (marker as any).getLatLng === 'function';
        if (isPoint) {
            // Point marker — create a single entry using getLatLng().
            const latLng = (marker as any).getLatLng() as L.LatLng;
            allEntries.push({
                layerId: member.layerId,
                historyId: member.historyId,
                latLng,
                marker
            });
        } else {
            // Polyline / polygon — one entry per vertex.
            const entries = buildFeatureSelectionEntries(marker, member.layerId);
            allEntries.push(...entries);
        }
    }

    if (allEntries.length === 0) {
        const previousEntries = selectionStore.selected;
        selectionStore.setSelected([]);
        selectionStore.markGroupSelection(id);
        applySelectionHighlights([], true, previousEntries);
        return;
    }

    // Track the group's members as the current selection and highlight them,
    // but do NOT enter area-selection mode. Selecting a group should only
    // reveal it; if the user wants to add to the group they can activate the
    // selection tool themselves.
    const previousEntries = selectionStore.selected;
    selectionStore.setSelected(allEntries);
    selectionStore.markGroupSelection(id);

    // Fit the map to the bounds of all selected features BEFORE applying
    // highlights. fitBounds can pan/zoom the map and recreate DivIcon marker
    // DOM elements, which would drop the CSS highlight class from point
    // markers. Applying highlights afterwards (with a non-animated fit) keeps
    // point, polygon and polyline highlights all in sync.
    const map = mapStore.map;
    if (map) {
        try {
            const bounds = L.latLngBounds(allEntries.map((e) => e.latLng));
            map.fitBounds(bounds, { padding: [50, 50], animate: false });
        } catch {
            // latLngBounds can throw if all points coincide — safe to ignore.
        }
    }

    if (highlightFeatures) {
        applySelectionHighlights(allEntries, true, previousEntries);
    }
}

export function fitGroupFeatures(bottomPadding: number): boolean {
    const groupStore = useGroupStore(pinia);
    const group = groupStore.detailsGroupId
        ? groupStore.groups.find((item) => item.id === groupStore.detailsGroupId)
        : null;
    const version = group ? getActiveVersion(group, groupStore.activeVersionIds[group.id]) : null;
    const map = useMapStore(pinia).map;
    if (!version || !map) {
        return false;
    }
    const entries = buildEntriesForMembers(version.members);
    if (entries.length === 0) {
        return false;
    }
    try {
        map.fitBounds(L.latLngBounds(entries.map((entry) => entry.latLng)), {
            paddingTopLeft: [40, 40],
            paddingBottomRight: [40, Math.max(40, bottomPadding + 24)],
            animate: false
        });
        return true;
    } catch {
        return false;
    }
}

export function fitGroupPhaseFeatures(bottomPadding: number): boolean {
    const groupStore = useGroupStore(pinia);
    const group = groupStore.phaseGroupId
        ? groupStore.groups.find((item) => item.id === groupStore.phaseGroupId)
        : null;
    const version =
        group && groupStore.phaseVersionId
            ? getGroupVersions(group).find((item) => item.id === groupStore.phaseVersionId)
            : null;
    const map = useMapStore(pinia).map;
    if (!version || !map) {
        return false;
    }
    const entries = buildEntriesForMembers(version.members);
    if (entries.length === 0) {
        return false;
    }
    try {
        map.fitBounds(L.latLngBounds(entries.map((entry) => entry.latLng)), {
            paddingTopLeft: [40, 40],
            paddingBottomRight: [40, Math.max(40, bottomPadding + 24)],
            animate: false
        });
        return true;
    } catch {
        return false;
    }
}
