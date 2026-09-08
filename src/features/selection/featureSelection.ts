import * as L from 'leaflet';
import { useMapStore } from '../../stores/mapStore';
import { useSelectionStore, type SelectedMarker } from '../../stores/selectionStore';
import { pinia } from '../../stores/index';
import { getFeatureHistoryId } from '../../composables/layers/layerUtils';
import { useGroupStore } from '../../stores/groupStore';
import { useFeatureDeletionStore } from '../../stores/featureDeletionStore';
import { findFeatureMemberships } from '../groups/featureMemberships';
import { getPolylineLatLngs } from '../../geometry/leafletGeometry';
import { SelectionHighlighter } from './SelectionHighlighter';
import {
    copySelection,
    deleteSelection,
    pasteSelection,
    type SelectionCommandContext
} from './selectionCommands';

let selectionHighlighter: SelectionHighlighter | null = null;

export function setSelectionHighlighter(highlighter: SelectionHighlighter): void {
    selectionHighlighter = highlighter;
}

export function releaseSelectionHighlighter(highlighter: SelectionHighlighter): void {
    if (selectionHighlighter === highlighter) {
        selectionHighlighter = null;
    }
}

/**
 * Build SelectedMarker entries for a single feature. For point markers this is
 * one entry at the marker's position; for polyline/polygon features it is one
 * entry per vertex.
 */
export function buildFeatureSelectionEntries(marker: L.Layer, layerId: string): SelectedMarker[] {
    const historyId = getFeatureHistoryId(marker);
    const anyMarker = marker as unknown as {
        getLatLng?: () => L.LatLng;
        getLatLngs?: () => unknown;
    };

    if (typeof anyMarker.getLatLng === 'function' && typeof anyMarker.getLatLngs !== 'function') {
        const latLng = anyMarker.getLatLng();
        return latLng ? [{ layerId, historyId, latLng, marker }] : [];
    }

    return getPolylineLatLngs(marker).map((latLng) => ({ layerId, historyId, latLng, marker }));
}

export function selectFeature(
    marker: L.Layer,
    layerId: string,
    additive: boolean,
    skipActivate = false,
    toggle = false
): void {
    const selectionStore = useSelectionStore(pinia);
    const entries = buildFeatureSelectionEntries(marker, layerId);
    if (entries.length === 0) {
        return;
    }

    const groupStore = useGroupStore(pinia);
    if (groupStore.phaseDraftActive) {
        if (groupStore.phaseGroupId) {
            selectionStore.markGroupSelection(groupStore.phaseGroupId);
        }
        selectionStore.setPhaseEditing(true);
        additive = true;
        toggle = true;
    }

    if (additive) {
        const previousEntries = selectionStore.selected;
        if (
            toggle &&
            (selectionStore.isActive || selectionStore.isGroupSelection) &&
            selectionStore.isFeatureFullySelected(entries)
        ) {
            selectionStore.removeSelectedFeature(marker, entries[0]);
            if (!skipActivate && !selectionStore.isActive) {
                selectionStore.activate();
            }
            applySelectionHighlights(selectionStore.selected, true, previousEntries);
            return;
        }

        if (
            selectionStore.isPhaseEditing &&
            (selectionStore.isGroupSelection || selectionStore.isActive) &&
            selectionStore.isFeatureFullySelected(entries)
        ) {
            selectionStore.removeSelectedFeature(marker, entries[0]);
            applySelectionHighlights(selectionStore.selected, true, previousEntries);
            return;
        }

        const addedEntries = selectionStore.mergeSelected(entries);
        if (!skipActivate && !selectionStore.isActive) {
            selectionStore.activate();
        }
        if (addedEntries.length > 0) {
            selectionHighlighter?.add(addedEntries);
        }
        return;
    }

    const previousEntries = selectionStore.selected;
    selectionStore.setSelected(entries);
    if (!skipActivate && !selectionStore.isActive) {
        selectionStore.activate();
    }
    selectionHighlighter?.replace(previousEntries, entries);
}

export function applySelectionHighlights(
    markers: SelectedMarker[],
    replace = true,
    previousMarkers = useSelectionStore(pinia).selected
): void {
    if (replace) {
        selectionHighlighter?.replace(previousMarkers, markers);
    } else {
        selectionHighlighter?.add(markers);
    }
}

export function clearFeatureHighlight(): void {
    const selectionStore = useSelectionStore(pinia);
    if (selectionStore.isActive) {
        return;
    }
    selectionHighlighter?.clear(selectionStore.selected);
    selectionStore.clear();
}

function getSelectionCommandContext(): SelectionCommandContext {
    const selectionStore = useSelectionStore(pinia);
    const mapStore = useMapStore(pinia);
    return {
        selected: selectionStore.selected,
        clipboard: selectionStore.clipboard,
        layers: mapStore.layers,
        visibleLayerIds: mapStore.visibleLayerIds,
        setVisibleLayerIds: (ids) => (mapStore.visibleLayerIds = ids),
        copyToClipboard: (entries) => selectionStore.copyToClipboard(entries),
        deactivateSelection: () => selectionStore.deactivate(),
        markLayerUpdated: (mutation) => {
            if (mutation) {
                mapStore.markLayerUpdated(mutation);
            } else {
                mapStore.markLayerUpdated();
            }
        }
    };
}

export function executeAreaDelete(): void {
    const selectionStore = useSelectionStore(pinia);
    const previousSelection = [...selectionStore.selected];
    const markers = new Set(previousSelection.map((entry) => entry.marker));
    if (markers.size === 1) {
        const marker = previousSelection[0]?.marker;
        const layerId = previousSelection[0]?.layerId;
        const historyId = marker ? getFeatureHistoryId(marker) : null;
        const layer = useMapStore(pinia).layers.find((item) => item.id === layerId);
        const vertices = marker ? getPolylineLatLngs(marker) : [];
        const selectedVertices = new Set(
            previousSelection
                .filter((entry) => entry.marker === marker)
                .map((entry) => entry.latLng)
        );
        if (
            marker &&
            layerId &&
            historyId &&
            layer?.kind === 'polyline' &&
            vertices.length > 0 &&
            vertices.every((vertex) => selectedVertices.has(vertex))
        ) {
            const groupStore = useGroupStore(pinia);
            const memberships = findFeatureMemberships(
                groupStore.groups,
                groupStore.activeVersionIds,
                { layerId, historyId }
            );
            if (memberships.length > 0) {
                useFeatureDeletionStore(pinia).open({ layerId, historyId, memberships });
                return;
            }
        }
    }
    deleteSelection(getSelectionCommandContext());
    applySelectionHighlights([], true, previousSelection);
}

export function executeCopy(): void {
    copySelection(getSelectionCommandContext());
}

export function executePaste(): void {
    pasteSelection(getSelectionCommandContext());
}
