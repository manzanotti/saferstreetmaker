/**
 * Tests for useGroups logic — createGroupFromSelection, finalizeCreateGroup,
 * deleteGroupWithElements, removeAllGroupElements, visibility recomputation.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia } from 'pinia';

vi.mock('leaflet', () => import('./__mocks__/leaflet'));

import * as L from 'leaflet';
import { pinia } from '../../src/stores/index';
import { useGroupStore } from '../../src/stores/groupStore';
import { useMapStore } from '../../src/stores/mapStore';
import { useSelectionStore, type SelectedMarker } from '../../src/stores/selectionStore';
import {
    createGroupFromSelection,
    finalizeCreateGroup,
    finalizeRenameGroup,
    deleteGroupWithElements,
    removeAllGroupElements,
    executeSplitsAndProceed,
    skipSplitsAndProceed,
    toggleGroupVisibility,
    setAllGroupsVisibility,
    resetGroupVisibility,
    pruneDanglingGroupMembers,
    deleteGroup,
    beginAddToGroup,
    addSelectionToGroup
} from '../../src/composables/useGroups';
import type { IMapLayer } from '../../src/composables/layers/IMapLayer';

// ── Helpers ───────────────────────────────────────────────────────────────

function makePointLayer(id: string): IMapLayer {
    const geoJsonLayer = new L.GeoJSON();
    return {
        id,
        title: id,
        kind: 'point',
        selected: false,
        visible: true,
        groupName: '',
        iconHtml: '',
        getToolbarButton: vi.fn(),
        getLegendEntry: vi.fn(),
        loadFromGeoJSON: vi.fn(),
        getLayer: () => geoJsonLayer,
        toGeoJSON: () => ({}),
        clearLayer: vi.fn()
    } as unknown as IMapLayer;
}

function makePolylineLayer(id: string): IMapLayer {
    const geoJsonLayer = new L.GeoJSON();
    return {
        ...makePointLayer(id),
        kind: 'polyline',
        getLayer: () => geoJsonLayer,
        loadFromGeoJSON: vi.fn()
    } as unknown as IMapLayer;
}

function makePointMarker(historyId: string): L.Layer {
    const m = {
        feature: { properties: { historyId } },
        getLatLng: () => ({ lat: 1, lng: 2 }),
        toGeoJSON: () => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [2, 1] },
            properties: { historyId }
        })
    } as unknown as L.Layer;
    return m;
}

function makePolylineMarker(historyId: string, latlngs: L.LatLng[]): any {
    return {
        feature: { properties: { historyId } },
        getLatLngs: () => latlngs,
        setLatLngs: vi.fn(),
        toGeoJSON: () => ({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: latlngs.map((v) => [v.lng, v.lat]) },
            properties: { historyId }
        })
    };
}

function makeSelected(
    layerId: string,
    historyId: string,
    marker: L.Layer,
    latLng = { lat: 1, lng: 2 } as unknown as L.LatLng
): SelectedMarker {
    return { layerId, historyId, latLng, marker };
}

/** A point marker that supports setStyle (like a CircleMarker) for visibility tests. */
function makeStyledMarker(historyId: string): any {
    return {
        feature: { properties: { historyId } },
        options: { opacity: 1, fillOpacity: 0.5 },
        getLatLng: () => ({ lat: 1, lng: 2 }),
        setStyle: vi.fn(function (this: any, style: any) {
            Object.assign(this.options, style);
        }),
        toGeoJSON: () => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [2, 1] },
            properties: { historyId }
        })
    };
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('useGroups', () => {
    beforeEach(() => {
        setActivePinia(pinia);
        vi.clearAllMocks();
        useGroupStore(pinia).setGroups([]);
        useGroupStore(pinia).setAllHidden(false);
        useGroupStore(pinia).clearPendingState();
        useGroupStore(pinia).closeNameDialog();
        useGroupStore(pinia).closeSplitDialog();
        useSelectionStore(pinia).deactivate();
        useMapStore(pinia).setLayers([]);
    });

    // ── createGroupFromSelection ──────────────────────────────────────────────

    describe('createGroupFromSelection()', () => {
        it('opens the name dialog when all features are fully selected', () => {
            const layer = makePointLayer('ModalFilters');
            const marker = makePointMarker('hist-1');
            layer.getLayer().addLayer(marker as any);
            useMapStore(pinia).setLayers([layer]);

            const selStore = useSelectionStore(pinia);
            selStore.setSelected([makeSelected('ModalFilters', 'hist-1', marker)]);
            selStore.activate();

            createGroupFromSelection();

            const groupStore = useGroupStore(pinia);
            expect(groupStore.nameDialogOpen).toBe(true);
            expect(groupStore.splitDialogOpen).toBe(false);
            expect(groupStore.pendingGroupMembers).toHaveLength(1);
            expect(groupStore.pendingGroupMembers[0]).toEqual({
                layerId: 'ModalFilters',
                historyId: 'hist-1'
            });
        });

        it('opens the split dialog when a polyline is partially selected', () => {
            const layer = makePolylineLayer('MobilityLanes');
            const v1 = { lat: 1, lng: 1 } as unknown as L.LatLng;
            const v2 = { lat: 2, lng: 2 } as unknown as L.LatLng;
            const v3 = { lat: 3, lng: 3 } as unknown as L.LatLng;
            const polyline = makePolylineMarker('poly-1', [v1, v2, v3]);
            layer.getLayer().addLayer(polyline as any);
            useMapStore(pinia).setLayers([layer]);

            const selStore = useSelectionStore(pinia);
            // Only select 2 of 3 vertices — partial selection.
            selStore.setSelected([
                makeSelected('MobilityLanes', 'poly-1', polyline as any, v1),
                makeSelected('MobilityLanes', 'poly-1', polyline as any, v2)
            ]);
            selStore.activate();

            createGroupFromSelection();

            const groupStore = useGroupStore(pinia);
            expect(groupStore.splitDialogOpen).toBe(true);
            expect(groupStore.nameDialogOpen).toBe(false);
            expect(groupStore.pendingSplits).toHaveLength(1);
            expect(groupStore.pendingSplits[0].layerTitle).toBe('MobilityLanes');
        });

        it('skips features with no historyId', () => {
            const layer = makePointLayer('ModalFilters');
            const marker = { feature: { properties: {} }, getLatLng: () => ({ lat: 1, lng: 2 }) };
            layer.getLayer().addLayer(marker as any);
            useMapStore(pinia).setLayers([layer]);

            const selStore = useSelectionStore(pinia);
            selStore.setSelected([makeSelected('ModalFilters', null as any, marker as any)]);
            selStore.activate();

            createGroupFromSelection();

            const groupStore = useGroupStore(pinia);
            expect(groupStore.pendingGroupMembers).toHaveLength(0);
        });

        it('does nothing when nothing is selected', () => {
            createGroupFromSelection();
            const groupStore = useGroupStore(pinia);
            expect(groupStore.nameDialogOpen).toBe(false);
            expect(groupStore.splitDialogOpen).toBe(false);
        });
    });

    // ── finalizeCreateGroup ───────────────────────────────────────────────────

    describe('beginAddToGroup() / addSelectionToGroup()', () => {
        it('beginAddToGroup targets the group and activates area selection', () => {
            const groupStore = useGroupStore(pinia);
            groupStore.addGroup({ id: 'g1', name: 'G', members: [] });
            const selStore = useSelectionStore(pinia);

            beginAddToGroup('g1');

            expect(groupStore.addToGroupId).toBe('g1');
            expect(selStore.isActive).toBe(true);
        });

        it('adds fully-selected features to an existing group and closes selection', () => {
            const layer = makePointLayer('ModalFilters');
            const marker = makePointMarker('hist-1');
            layer.getLayer().addLayer(marker as any);
            useMapStore(pinia).setLayers([layer]);

            const groupStore = useGroupStore(pinia);
            groupStore.addGroup({ id: 'g1', name: 'G', members: [] });

            const selStore = useSelectionStore(pinia);
            selStore.setSelected([makeSelected('ModalFilters', 'hist-1', marker)]);
            selStore.activate();

            const markSpy = vi.spyOn(useMapStore(pinia), 'markLayerUpdated');
            addSelectionToGroup('g1');

            expect(groupStore.groups[0].members).toEqual([
                { layerId: 'ModalFilters', historyId: 'hist-1' }
            ]);
            expect(groupStore.addToGroupId).toBeNull();
            expect(selStore.isActive).toBe(false);
            expect(markSpy).toHaveBeenCalledOnce();
        });

        it('does not duplicate a member already in the target group', () => {
            const layer = makePointLayer('ModalFilters');
            const marker = makePointMarker('hist-1');
            layer.getLayer().addLayer(marker as any);
            useMapStore(pinia).setLayers([layer]);

            const groupStore = useGroupStore(pinia);
            groupStore.addGroup({
                id: 'g1',
                name: 'G',
                members: [{ layerId: 'ModalFilters', historyId: 'hist-1' }]
            });

            const selStore = useSelectionStore(pinia);
            selStore.setSelected([makeSelected('ModalFilters', 'hist-1', marker)]);
            selStore.activate();

            addSelectionToGroup('g1');

            expect(groupStore.groups[0].members).toHaveLength(1);
        });

        it('routes a partially-selected polyline through the split dialog into the group', () => {
            const layer = makePolylineLayer('MobilityLanes');
            const v1 = { lat: 1, lng: 1 } as unknown as L.LatLng;
            const v2 = { lat: 2, lng: 2 } as unknown as L.LatLng;
            const v3 = { lat: 3, lng: 3 } as unknown as L.LatLng;
            const polyline = makePolylineMarker('poly-1', [v1, v2, v3]);
            layer.getLayer().addLayer(polyline as any);
            useMapStore(pinia).setLayers([layer]);

            const groupStore = useGroupStore(pinia);
            groupStore.addGroup({ id: 'g1', name: 'G', members: [] });

            const selStore = useSelectionStore(pinia);
            selStore.setSelected([
                makeSelected('MobilityLanes', 'poly-1', polyline as any, v1),
                makeSelected('MobilityLanes', 'poly-1', polyline as any, v2)
            ]);
            selStore.activate();

            addSelectionToGroup('g1');

            // Partial selection defers to the split dialog; nothing added yet.
            expect(groupStore.splitDialogOpen).toBe(true);
            expect(groupStore.addToGroupId).toBe('g1');
            expect(groupStore.groups[0].members).toHaveLength(0);

            // Approving the split finalises the add WITHOUT opening the name dialog.
            executeSplitsAndProceed();

            expect(groupStore.nameDialogOpen).toBe(false);
            expect(groupStore.splitDialogOpen).toBe(false);
            expect(groupStore.groups[0].members).toHaveLength(1);
            expect(groupStore.addToGroupId).toBeNull();
            expect(selStore.isActive).toBe(false);
        });
    });

    describe('finalizeCreateGroup()', () => {
        it('creates a group with pending members and marks layer updated', () => {
            const groupStore = useGroupStore(pinia);
            const mapStore = useMapStore(pinia);
            const markSpy = vi.spyOn(mapStore, 'markLayerUpdated');

            groupStore.setPendingGroupMembers([{ layerId: 'ModalFilters', historyId: 'h1' }]);
            finalizeCreateGroup('My Group');

            expect(groupStore.groups).toHaveLength(1);
            expect(groupStore.groups[0].name).toBe('My Group');
            expect(groupStore.groups[0].members).toHaveLength(1);
            expect(groupStore.nameDialogOpen).toBe(false);
            expect(markSpy).toHaveBeenCalledOnce();
        });

        it('trims the group name', () => {
            useGroupStore(pinia).setPendingGroupMembers([]);
            finalizeCreateGroup('  Padded  ');
            expect(useGroupStore(pinia).groups[0].name).toBe('Padded');
        });

        it('does nothing for an empty name', () => {
            finalizeCreateGroup('   ');
            expect(useGroupStore(pinia).groups).toHaveLength(0);
        });

        it('deactivates the area selection so the selection pop-up closes', () => {
            const groupStore = useGroupStore(pinia);
            const selectionStore = useSelectionStore(pinia);

            selectionStore.activate();
            selectionStore.setSelected([
                { layerId: 'ModalFilters', historyId: 'h1', latLng: {} as any, marker: {} as any }
            ]);
            groupStore.setPendingGroupMembers([{ layerId: 'ModalFilters', historyId: 'h1' }]);

            finalizeCreateGroup('Closes Popup');

            expect(selectionStore.isActive).toBe(false);
            expect(selectionStore.selected).toHaveLength(0);
        });
    });

    // ── finalizeRenameGroup ───────────────────────────────────────────────────

    describe('finalizeRenameGroup()', () => {
        it('renames a group and marks layer updated', () => {
            const groupStore = useGroupStore(pinia);
            groupStore.addGroup({ id: 'g1', name: 'Old', members: [] });
            const mapStore = useMapStore(pinia);
            const markSpy = vi.spyOn(mapStore, 'markLayerUpdated');

            finalizeRenameGroup('g1', 'New Name');

            expect(groupStore.groups[0].name).toBe('New Name');
            expect(markSpy).toHaveBeenCalledOnce();
        });
    });

    // ── deleteGroupWithElements ───────────────────────────────────────────────

    describe('deleteGroupWithElements()', () => {
        it('removes group members from their layers and removes the group', () => {
            const layer = makePointLayer('ModalFilters');
            const marker = makePointMarker('h1');
            layer.getLayer().addLayer(marker as any);
            useMapStore(pinia).setLayers([layer]);

            const groupStore = useGroupStore(pinia);
            groupStore.addGroup({
                id: 'g1',
                name: 'Test',
                members: [{ layerId: 'ModalFilters', historyId: 'h1' }]
            });

            const mapStore = useMapStore(pinia);
            const markSpy = vi.spyOn(mapStore, 'markLayerUpdated');

            deleteGroupWithElements('g1');

            expect(layer.getLayer().getLayers()).toHaveLength(0);
            expect(groupStore.groups).toHaveLength(0);
            expect(markSpy).toHaveBeenCalledOnce();
        });

        it('does nothing for an unknown group id', () => {
            deleteGroupWithElements('nonexistent');
            expect(useGroupStore(pinia).groups).toHaveLength(0);
        });
    });

    // ── removeAllGroupElements / deleteGroup ──────────────────────────────────

    describe('removeAllGroupElements()', () => {
        it('clears members without removing features from the map', () => {
            const layer = makePointLayer('ModalFilters');
            const marker = makePointMarker('h1');
            layer.getLayer().addLayer(marker as any);
            useMapStore(pinia).setLayers([layer]);

            const groupStore = useGroupStore(pinia);
            groupStore.addGroup({
                id: 'g1',
                name: 'Test',
                members: [{ layerId: 'ModalFilters', historyId: 'h1' }]
            });

            removeAllGroupElements('g1');

            expect(groupStore.groups[0].members).toHaveLength(0);
            // Feature stays on the map.
            expect(layer.getLayer().getLayers()).toHaveLength(1);
        });
    });

    describe('deleteGroup()', () => {
        it('removes the group and marks layer updated', () => {
            const groupStore = useGroupStore(pinia);
            groupStore.addGroup({ id: 'g1', name: 'Empty', members: [] });
            const markSpy = vi.spyOn(useMapStore(pinia), 'markLayerUpdated');

            deleteGroup('g1');

            expect(groupStore.groups).toHaveLength(0);
            expect(markSpy).toHaveBeenCalledOnce();
        });

        it('deletes a non-empty group but leaves its member features on the map', () => {
            const layer = makePointLayer('ModalFilters');
            const marker = makePointMarker('h1');
            layer.getLayer().addLayer(marker as any);
            useMapStore(pinia).setLayers([layer]);

            const groupStore = useGroupStore(pinia);
            groupStore.addGroup({
                id: 'g1',
                name: 'Keep Elements',
                members: [{ layerId: 'ModalFilters', historyId: 'h1' }]
            });

            deleteGroup('g1');

            // Group gone, but the feature remains on the map.
            expect(groupStore.groups).toHaveLength(0);
            expect(layer.getLayer().getLayers()).toHaveLength(1);
        });

        it('clears the current selection so the ungrouped elements are not left highlighted', () => {
            const layer = makePointLayer('ModalFilters');
            const marker = makePointMarker('h1');
            layer.getLayer().addLayer(marker as any);
            useMapStore(pinia).setLayers([layer]);

            const groupStore = useGroupStore(pinia);
            groupStore.addGroup({
                id: 'g1',
                name: 'Selected',
                members: [{ layerId: 'ModalFilters', historyId: 'h1' }]
            });

            // Simulate having selected the group (members tracked in selection).
            const selStore = useSelectionStore(pinia);
            selStore.setSelected([makeSelected('ModalFilters', 'h1', marker as any)]);

            deleteGroup('g1');

            expect(selStore.selected).toHaveLength(0);
        });
    });

    // ── executeSplitsAndProceed (deferred split) ──────────────────────────────

    describe('executeSplitsAndProceed()', () => {
        it('approves the split and opens the name dialog WITHOUT mutating the map', () => {
            const layer = makePolylineLayer('MobilityLanes');
            const v1 = { lat: 1, lng: 1 } as unknown as L.LatLng;
            const v2 = { lat: 2, lng: 2 } as unknown as L.LatLng;
            const v3 = { lat: 3, lng: 3 } as unknown as L.LatLng;
            const polyline = makePolylineMarker('poly-1', [v1, v2, v3]);
            layer.getLayer().addLayer(polyline as any);
            useMapStore(pinia).setLayers([layer]);

            const groupStore = useGroupStore(pinia);
            groupStore.openSplitDialog([
                {
                    layerId: 'MobilityLanes',
                    layerTitle: 'Mobility Lane',
                    marker: polyline as any,
                    selectedLatLngs: [v1, v2],
                    allLatLngs: [v1, v2, v3]
                }
            ]);

            executeSplitsAndProceed();

            // The split is deferred — the map must NOT have been mutated yet.
            expect(polyline.setLatLngs).not.toHaveBeenCalled();
            expect(layer.loadFromGeoJSON).not.toHaveBeenCalled();

            // Dialog transitions and pendingSplits is retained for finalize.
            expect(groupStore.splitDialogOpen).toBe(false);
            expect(groupStore.nameDialogOpen).toBe(true);
            expect(groupStore.pendingSplits).toHaveLength(1);
        });

        it('performs the split when the group is finalized (single checkpoint)', () => {
            const layer = makePolylineLayer('MobilityLanes');
            const v1 = { lat: 1, lng: 1 } as unknown as L.LatLng;
            const v2 = { lat: 2, lng: 2 } as unknown as L.LatLng;
            const v3 = { lat: 3, lng: 3 } as unknown as L.LatLng;
            const v4 = { lat: 4, lng: 4 } as unknown as L.LatLng;
            const polyline = makePolylineMarker('poly-1', [v1, v2, v3, v4]);
            layer.getLayer().addLayer(polyline as any);
            useMapStore(pinia).setLayers([layer]);

            const groupStore = useGroupStore(pinia);
            const markSpy = vi.spyOn(useMapStore(pinia), 'markLayerUpdated');
            groupStore.setPendingGroupMembers([]);
            groupStore.openSplitDialog([
                {
                    layerId: 'MobilityLanes',
                    layerTitle: 'Mobility Lane',
                    marker: polyline as any,
                    selectedLatLngs: [v1, v2],
                    allLatLngs: [v1, v2, v3, v4]
                }
            ]);

            executeSplitsAndProceed();
            finalizeCreateGroup('Split Group');

            // Original removed; both halves recreated as fresh lines (the
            // grouped inside line + the ungrouped remaining line).
            expect(polyline.setLatLngs).not.toHaveBeenCalled();
            expect(layer.getLayer().getLayers()).toHaveLength(0);
            expect(layer.loadFromGeoJSON).toHaveBeenCalledTimes(2);
            // Group holds only the new split (inside) line as its sole member.
            expect(groupStore.groups).toHaveLength(1);
            expect(groupStore.groups[0].members).toHaveLength(1);
            // Single checkpoint for the whole operation.
            expect(markSpy).toHaveBeenCalledOnce();
        });

        it('cancelling the name dialog after approving a split leaves the map untouched', () => {
            const layer = makePolylineLayer('MobilityLanes');
            const v1 = { lat: 1, lng: 1 } as unknown as L.LatLng;
            const v2 = { lat: 2, lng: 2 } as unknown as L.LatLng;
            const v3 = { lat: 3, lng: 3 } as unknown as L.LatLng;
            const polyline = makePolylineMarker('poly-1', [v1, v2, v3]);
            layer.getLayer().addLayer(polyline as any);
            useMapStore(pinia).setLayers([layer]);

            const groupStore = useGroupStore(pinia);
            const markSpy = vi.spyOn(useMapStore(pinia), 'markLayerUpdated');
            groupStore.openSplitDialog([
                {
                    layerId: 'MobilityLanes',
                    layerTitle: 'Mobility Lane',
                    marker: polyline as any,
                    selectedLatLngs: [v1, v2],
                    allLatLngs: [v1, v2, v3]
                }
            ]);

            executeSplitsAndProceed();
            // Simulate the name dialog Cancel button.
            groupStore.clearPendingState();
            groupStore.closeNameDialog();

            // No split performed, no group created, no checkpoint.
            expect(polyline.setLatLngs).not.toHaveBeenCalled();
            expect(layer.loadFromGeoJSON).not.toHaveBeenCalled();
            expect(layer.getLayer().getLayers()).toHaveLength(1);
            expect(groupStore.groups).toHaveLength(0);
            expect(markSpy).not.toHaveBeenCalled();
        });

        it('removes the original when only 1 vertex remains after the finalized split', () => {
            const layer = makePolylineLayer('MobilityLanes');
            const v1 = { lat: 1, lng: 1 } as unknown as L.LatLng;
            const v2 = { lat: 2, lng: 2 } as unknown as L.LatLng;
            const polyline = makePolylineMarker('poly-1', [v1, v2]);
            layer.getLayer().addLayer(polyline as any);
            useMapStore(pinia).setLayers([layer]);

            const groupStore = useGroupStore(pinia);
            groupStore.openSplitDialog([
                {
                    layerId: 'MobilityLanes',
                    layerTitle: 'Mobility Lane',
                    marker: polyline as any,
                    selectedLatLngs: [v1],
                    allLatLngs: [v1, v2]
                }
            ]);

            executeSplitsAndProceed();
            finalizeCreateGroup('Tiny Split');

            // Original is removed (only 1 vertex left).
            expect(layer.getLayer().getLayers()).toHaveLength(0);
            // No new line created (only 1 selected vertex).
            expect(layer.loadFromGeoJSON).not.toHaveBeenCalled();
        });
    });

    // ── skipSplitsAndProceed ──────────────────────────────────────────────────

    describe('skipSplitsAndProceed()', () => {
        it('closes split dialog and opens name dialog without splitting', () => {
            const layer = makePolylineLayer('MobilityLanes');
            useMapStore(pinia).setLayers([layer]);

            const groupStore = useGroupStore(pinia);
            groupStore.openSplitDialog([
                {
                    layerId: 'MobilityLanes',
                    layerTitle: 'Mobility Lane',
                    marker: {} as any,
                    selectedLatLngs: [],
                    allLatLngs: []
                }
            ]);

            skipSplitsAndProceed();

            expect(groupStore.splitDialogOpen).toBe(false);
            expect(groupStore.nameDialogOpen).toBe(true);
        });
    });

    // ── clipped split (extend new line to selection edge) ─────────────────────

    describe('clipped polyline split', () => {
        it('clips the new line to the selection rectangle, adding boundary points', () => {
            const layer = makePolylineLayer('MobilityLanes');
            // Horizontal line at lat 5 crossing a rectangle spanning lng 0..10.
            const v0 = { lat: 5, lng: -5 } as unknown as L.LatLng; // outside (west)
            const v1 = { lat: 5, lng: 5 } as unknown as L.LatLng; // inside
            const v2 = { lat: 5, lng: 15 } as unknown as L.LatLng; // outside (east)
            const polyline = makePolylineMarker('poly-1', [v0, v1, v2]);
            layer.getLayer().addLayer(polyline as any);
            useMapStore(pinia).setLayers([layer]);

            const bounds = {
                getWest: () => 0,
                getEast: () => 10,
                getSouth: () => 0,
                getNorth: () => 10
            } as unknown as L.LatLngBounds;

            const groupStore = useGroupStore(pinia);
            groupStore.setPendingGroupMembers([]);
            groupStore.openSplitDialog([
                {
                    layerId: 'MobilityLanes',
                    layerTitle: 'Mobility Lane',
                    marker: polyline as any,
                    selectedLatLngs: [v1],
                    allLatLngs: [v0, v1, v2],
                    clipBounds: bounds
                }
            ]);

            executeSplitsAndProceed();
            finalizeCreateGroup('Clipped');

            // The new line reaches the rectangle edges at lng 0 and lng 10.
            const fc = (layer.loadFromGeoJSON as any).mock.calls[0][0];
            const coords = fc.features[0].geometry.coordinates;
            expect(coords).toEqual([
                [0, 5],
                [5, 5],
                [10, 5]
            ]);
            // A single contiguous inside run ⇒ one new group member.
            expect(groupStore.groups[0].members).toHaveLength(1);
        });

        it('produces a separate line for each inside run when the path exits and re-enters', () => {
            const layer = makePolylineLayer('MobilityLanes');
            // Path: inside, outside, inside ⇒ two runs.
            const v0 = { lat: 5, lng: 5 } as unknown as L.LatLng; // inside
            const v1 = { lat: 5, lng: 15 } as unknown as L.LatLng; // outside
            const v2 = { lat: 5, lng: 25 } as unknown as L.LatLng; // outside
            const v3 = { lat: 5, lng: 5 } as unknown as L.LatLng; // inside (distinct ref)
            const polyline = makePolylineMarker('poly-1', [v0, v1, v2, v3]);
            layer.getLayer().addLayer(polyline as any);
            useMapStore(pinia).setLayers([layer]);

            const bounds = {
                getWest: () => 0,
                getEast: () => 10,
                getSouth: () => 0,
                getNorth: () => 10
            } as unknown as L.LatLngBounds;

            const groupStore = useGroupStore(pinia);
            groupStore.setPendingGroupMembers([]);
            groupStore.openSplitDialog([
                {
                    layerId: 'MobilityLanes',
                    layerTitle: 'Mobility Lane',
                    marker: polyline as any,
                    selectedLatLngs: [v0, v3],
                    allLatLngs: [v0, v1, v2, v3],
                    clipBounds: bounds
                }
            ]);

            executeSplitsAndProceed();
            finalizeCreateGroup('Two Runs');

            // Two inside runs ⇒ two group members, plus one recreated remaining
            // (middle, outside) line ⇒ three loadFromGeoJSON calls total.
            expect(layer.loadFromGeoJSON).toHaveBeenCalledTimes(3);
            expect(groupStore.groups[0].members).toHaveLength(2);
        });

        it('extends the remaining line to the selection edge (end selection)', () => {
            const layer = makePolylineLayer('MobilityLanes');
            // Horizontal line at lat 5; select the eastern end.
            const v0 = { lat: 5, lng: -5 } as unknown as L.LatLng; // outside (west)
            const v1 = { lat: 5, lng: 5 } as unknown as L.LatLng; // inside
            const v2 = { lat: 5, lng: 15 } as unknown as L.LatLng; // inside (beyond east edge? no, inside rect)
            const polyline = makePolylineMarker('poly-1', [v0, v1, v2]);
            layer.getLayer().addLayer(polyline as any);
            useMapStore(pinia).setLayers([layer]);

            const bounds = {
                getWest: () => 0,
                getEast: () => 20,
                getSouth: () => 0,
                getNorth: () => 10
            } as unknown as L.LatLngBounds;

            const groupStore = useGroupStore(pinia);
            groupStore.setPendingGroupMembers([]);
            groupStore.openSplitDialog([
                {
                    layerId: 'MobilityLanes',
                    layerTitle: 'Mobility Lane',
                    marker: polyline as any,
                    selectedLatLngs: [v1, v2],
                    allLatLngs: [v0, v1, v2],
                    clipBounds: bounds
                }
            ]);

            executeSplitsAndProceed();
            finalizeCreateGroup('End Split');

            // The original is removed and recreated as two fresh lines: the
            // grouped inside line (call 0) and the remaining outside line
            // (call 1). The remaining line keeps v0 and is extended to the
            // western rectangle edge at lng 0 — no gap at the split.
            expect(polyline.setLatLngs).not.toHaveBeenCalled();
            expect(layer.getLayer().getLayers()).toHaveLength(0);
            expect(layer.loadFromGeoJSON).toHaveBeenCalledTimes(2);
            const remainingCoords = (layer.loadFromGeoJSON as any).mock.calls[1][0].features[0]
                .geometry.coordinates;
            expect(remainingCoords).toEqual([
                [-5, 5],
                [0, 5]
            ]);
        });

        it('splits the remaining geometry into two lines when the selection is in the middle', () => {
            const layer = makePolylineLayer('MobilityLanes');
            // Horizontal line; select only the middle vertex.
            const v0 = { lat: 5, lng: -5 } as unknown as L.LatLng; // outside (west)
            const v1 = { lat: 5, lng: 5 } as unknown as L.LatLng; // inside
            const v2 = { lat: 5, lng: 15 } as unknown as L.LatLng; // outside (east)
            const polyline = makePolylineMarker('poly-1', [v0, v1, v2]);
            layer.getLayer().addLayer(polyline as any);
            useMapStore(pinia).setLayers([layer]);

            const bounds = {
                getWest: () => 0,
                getEast: () => 10,
                getSouth: () => 0,
                getNorth: () => 10
            } as unknown as L.LatLngBounds;

            const groupStore = useGroupStore(pinia);
            groupStore.setPendingGroupMembers([]);
            groupStore.openSplitDialog([
                {
                    layerId: 'MobilityLanes',
                    layerTitle: 'Mobility Lane',
                    marker: polyline as any,
                    selectedLatLngs: [v1],
                    allLatLngs: [v0, v1, v2],
                    clipBounds: bounds
                }
            ]);

            executeSplitsAndProceed();
            finalizeCreateGroup('Middle Split');

            // The original is removed and the geometry recreated as three fresh
            // lines: [0] the grouped inside line, [1] the west remaining line,
            // [2] the east remaining line — each reaching the selection edge.
            expect(polyline.setLatLngs).not.toHaveBeenCalled();
            expect(layer.getLayer().getLayers()).toHaveLength(0);
            expect(layer.loadFromGeoJSON).toHaveBeenCalledTimes(3);

            const westCoords = (layer.loadFromGeoJSON as any).mock.calls[1][0].features[0].geometry
                .coordinates;
            expect(westCoords).toEqual([
                [-5, 5],
                [0, 5]
            ]);
            const eastCoords = (layer.loadFromGeoJSON as any).mock.calls[2][0].features[0].geometry
                .coordinates;
            expect(eastCoords).toEqual([
                [10, 5],
                [15, 5]
            ]);
            // Only the inside line joins the group.
            expect(groupStore.groups[0].members).toHaveLength(1);
        });
    });

    // ── Visibility ────────────────────────────────────────────────────────────

    describe('toggleGroupVisibility() / recompute', () => {
        it('hides a member marker when its group is hidden and shows it when revealed', () => {
            const layer = makePointLayer('ModalFilters');
            const marker = makeStyledMarker('h1');
            layer.getLayer().addLayer(marker as any);
            useMapStore(pinia).setLayers([layer]);

            const groupStore = useGroupStore(pinia);
            groupStore.addGroup({
                id: 'g1',
                name: 'V',
                members: [{ layerId: 'ModalFilters', historyId: 'h1' }]
            });

            toggleGroupVisibility('g1');
            expect(marker.options.opacity).toBe(0);
            expect(marker.options.fillOpacity).toBe(0);

            toggleGroupVisibility('g1');
            expect(marker.options.opacity).toBe(1);
            expect(marker.options.fillOpacity).toBe(0.5);
        });

        it('keeps a member visible while at least one of its groups is visible', () => {
            const layer = makePointLayer('ModalFilters');
            const marker = makeStyledMarker('h1');
            layer.getLayer().addLayer(marker as any);
            useMapStore(pinia).setLayers([layer]);

            const groupStore = useGroupStore(pinia);
            // Member is in both groups.
            groupStore.addGroup({
                id: 'gA',
                name: 'A',
                members: [{ layerId: 'ModalFilters', historyId: 'h1' }]
            });
            groupStore.addGroup({
                id: 'gB',
                name: 'B',
                members: [{ layerId: 'ModalFilters', historyId: 'h1' }]
            });

            // Hide only group A — member stays visible (still in visible group B).
            toggleGroupVisibility('gA');
            expect(marker.options.opacity).toBe(1);

            // Hide group B too — now every containing group is hidden.
            toggleGroupVisibility('gB');
            expect(marker.options.opacity).toBe(0);
        });

        it('does NOT leave a member hidden after its group members are removed (no ghost)', () => {
            const layer = makePointLayer('ModalFilters');
            const marker = makeStyledMarker('h1');
            layer.getLayer().addLayer(marker as any);
            useMapStore(pinia).setLayers([layer]);

            const groupStore = useGroupStore(pinia);
            groupStore.addGroup({
                id: 'g1',
                name: 'V',
                members: [{ layerId: 'ModalFilters', historyId: 'h1' }]
            });

            // Hide the group, then remove all its members.
            toggleGroupVisibility('g1');
            expect(marker.options.opacity).toBe(0);

            removeAllGroupElements('g1');

            // The formerly-hidden member must be revealed again.
            expect(marker.options.opacity).toBe(1);
            expect(marker.options.fillOpacity).toBe(0.5);
        });

        it('reveals members when an empty hidden group is deleted', () => {
            const layer = makePointLayer('ModalFilters');
            const marker = makeStyledMarker('h1');
            layer.getLayer().addLayer(marker as any);
            useMapStore(pinia).setLayers([layer]);

            const groupStore = useGroupStore(pinia);
            groupStore.addGroup({
                id: 'g1',
                name: 'V',
                members: [{ layerId: 'ModalFilters', historyId: 'h1' }]
            });

            toggleGroupVisibility('g1');
            expect(marker.options.opacity).toBe(0);

            // Deleting the whole group (empty-group path) reveals the member.
            deleteGroup('g1');
            expect(marker.options.opacity).toBe(1);
        });

        it('setAllGroupsVisibility hides then shows all group members', () => {
            const layer = makePointLayer('ModalFilters');
            const markerA = makeStyledMarker('h1');
            const markerB = makeStyledMarker('h2');
            layer.getLayer().addLayer(markerA as any);
            layer.getLayer().addLayer(markerB as any);
            useMapStore(pinia).setLayers([layer]);

            const groupStore = useGroupStore(pinia);
            groupStore.addGroup({
                id: 'gA',
                name: 'A',
                members: [{ layerId: 'ModalFilters', historyId: 'h1' }]
            });
            groupStore.addGroup({
                id: 'gB',
                name: 'B',
                members: [{ layerId: 'ModalFilters', historyId: 'h2' }]
            });

            setAllGroupsVisibility(true);
            expect(markerA.options.opacity).toBe(0);
            expect(markerB.options.opacity).toBe(0);

            setAllGroupsVisibility(false);
            expect(markerA.options.opacity).toBe(1);
            expect(markerB.options.opacity).toBe(1);
        });

        it('resetGroupVisibility reveals hidden members after groups are cleared', () => {
            const layer = makePointLayer('ModalFilters');
            const marker = makeStyledMarker('h1');
            layer.getLayer().addLayer(marker as any);
            useMapStore(pinia).setLayers([layer]);

            const groupStore = useGroupStore(pinia);
            groupStore.addGroup({
                id: 'g1',
                name: 'V',
                members: [{ layerId: 'ModalFilters', historyId: 'h1' }]
            });

            toggleGroupVisibility('g1');
            expect(marker.options.opacity).toBe(0);

            groupStore.setGroups([]);
            groupStore.setAllHidden(false);
            resetGroupVisibility();

            expect(marker.options.opacity).toBe(1);
            expect(marker.options.fillOpacity).toBe(0.5);
        });
    });

    // ── pruneDanglingGroupMembers ─────────────────────────────────────────────

    describe('pruneDanglingGroupMembers()', () => {
        it('removes members whose feature no longer exists on the map', () => {
            const layer = makePointLayer('ModalFilters');
            const marker = makePointMarker('h1');
            layer.getLayer().addLayer(marker as any);
            useMapStore(pinia).setLayers([layer]);

            const groupStore = useGroupStore(pinia);
            groupStore.addGroup({
                id: 'g1',
                name: 'G',
                members: [
                    { layerId: 'ModalFilters', historyId: 'h1' },
                    { layerId: 'ModalFilters', historyId: 'gone' }
                ]
            });

            const changed = pruneDanglingGroupMembers();

            expect(changed).toBe(true);
            expect(groupStore.groups[0].members).toEqual([
                { layerId: 'ModalFilters', historyId: 'h1' }
            ]);
        });

        it('returns false and leaves groups intact when all members exist', () => {
            const layer = makePointLayer('ModalFilters');
            const marker = makePointMarker('h1');
            layer.getLayer().addLayer(marker as any);
            useMapStore(pinia).setLayers([layer]);

            const groupStore = useGroupStore(pinia);
            groupStore.addGroup({
                id: 'g1',
                name: 'G',
                members: [{ layerId: 'ModalFilters', historyId: 'h1' }]
            });

            const changed = pruneDanglingGroupMembers();

            expect(changed).toBe(false);
            expect(groupStore.groups[0].members).toHaveLength(1);
        });

        it('is a no-op when there are no groups', () => {
            useMapStore(pinia).setLayers([makePointLayer('ModalFilters')]);
            expect(pruneDanglingGroupMembers()).toBe(false);
        });
    });
});
