/**
 * useGroups.ts
 *
 * Core group logic — exported as plain functions that read from the shared
 * Pinia singleton, following the same pattern as useAreaSelection.ts.
 *
 * Group visibility is runtime-only (not persisted, not undoable). All other
 * mutations (create, rename, remove-members, delete-with-elements) call
 * mapStore.markLayerUpdated() so the snapshot journal creates a checkpoint.
 *
 * Multi-group visibility rule: a feature is hidden only when EVERY group it
 * belongs to is hidden; showing any one of its groups reveals it.
 */
import * as L from 'leaflet';
import { useMapStore } from '../stores/mapStore';
import { useSelectionStore } from '../stores/selectionStore';
import { useGroupStore, type PartialPolylineSplit } from '../stores/groupStore';
import { pinia } from '../stores/index';
import { buildHistoryId, getFeatureHistoryId } from './layers/layerUtils';
import {
    buildFeatureSelectionEntries,
    applySelectionHighlights,
    clearFeatureHighlight
} from './useAreaSelection';
import type { GroupMember } from '../models/Group';
import type { SelectedMarker } from '../stores/selectionStore';

/**
 * Recompute visual visibility for all group members based on current
 * hiddenGroupIds. A feature is hidden only when every group it belongs to
 * is hidden; showing any one group reveals the feature.
 *
 * Reconciles against `currentlyHidden` so markers that are no longer members
 * of any hidden group (e.g. after their group's members were cleared or the
 * group was deleted) are revealed rather than left as invisible "ghosts".
 */
export function recomputeFeatureVisibility(): void {
    const groupStore = useGroupStore(pinia);
    const groups = groupStore.groups;

    // Build: memberKey → set of groupIds that contain this member.
    const memberToGroupIds = new Map<string, Set<string>>();
    const memberByKey = new Map<string, GroupMember>();

    for (const group of groups) {
        for (const member of group.members) {
            const key = `${member.layerId}:${member.historyId}`;
            if (!memberToGroupIds.has(key)) {
                memberToGroupIds.set(key, new Set());
                memberByKey.set(key, member);
            }
            memberToGroupIds.get(key)!.add(group.id);
        }
    }

    // Determine which markers SHOULD be hidden right now.
    const desiredHidden = new Set<L.Layer>();
    for (const [key, groupIds] of memberToGroupIds) {
        const shouldBeHidden = [...groupIds].every((gid) => groupStore.hiddenGroupIds.has(gid));
        if (!shouldBeHidden) {
            continue;
        }
        const member = memberByKey.get(key)!;
        const marker = findMarkerByHistoryId(member.layerId, member.historyId);
        if (marker) {
            desiredHidden.add(marker);
        }
    }

    // Reveal markers that are currently hidden but should no longer be
    // (including orphans no longer referenced by any group).
    for (const marker of [...currentlyHidden]) {
        if (!desiredHidden.has(marker)) {
            showMarker(marker);
        }
    }

    // Hide markers that should be hidden but are not yet.
    for (const marker of desiredHidden) {
        if (!currentlyHidden.has(marker)) {
            hideMarker(marker);
        }
    }
}

// ── Module-level visibility state ─────────────────────────────────────────
/**
 * Tracks original styles for markers currently hidden by group visibility.
 * WeakMap keys are L.Layer objects (not proxied).
 */
const hiddenStyles = new WeakMap<object, { opacity: number; fillOpacity: number }>();

/**
 * Iterable set of markers currently hidden by group visibility. Needed because
 * a WeakMap cannot be iterated, and recomputeFeatureVisibility must be able to
 * reveal markers that are no longer members of any hidden group (e.g. after a
 * group's members are cleared or the group is deleted). Runtime-only.
 */
const currentlyHidden = new Set<L.Layer>();

// ── Internal helpers ──────────────────────────────────────────────────────

function getPolylineLatLngs(marker: L.Layer): L.LatLng[] {
    const raw = (marker as any).getLatLngs?.();
    if (!raw || !Array.isArray(raw) || raw.length === 0) {
        return [];
    }
    // Flatten polygon rings if nested.
    if (Array.isArray(raw[0])) {
        return (raw as L.LatLng[][]).flat();
    }
    return raw as L.LatLng[];
}

/**
 * Liang–Barsky clip of the segment a→b against the axis-aligned bounds.
 * Returns the [tEnter, tExit] parameters (0..1 along a→b) of the portion
 * inside the rectangle, or null when the segment does not intersect it.
 * Operates in lng/lat space (planar approximation, fine at map scale).
 */
function clipSegmentParams(
    a: L.LatLng,
    b: L.LatLng,
    bounds: L.LatLngBounds
): [number, number] | null {
    const xmin = bounds.getWest();
    const xmax = bounds.getEast();
    const ymin = bounds.getSouth();
    const ymax = bounds.getNorth();

    const dx = b.lng - a.lng;
    const dy = b.lat - a.lat;

    const p = [-dx, dx, -dy, dy];
    const q = [a.lng - xmin, xmax - a.lng, a.lat - ymin, ymax - a.lat];

    let tEnter = 0;
    let tExit = 1;

    for (let i = 0; i < 4; i++) {
        if (p[i] === 0) {
            // Segment parallel to this edge — reject if outside the slab.
            if (q[i] < 0) {
                return null;
            }
        } else {
            const r = q[i] / p[i];
            if (p[i] < 0) {
                if (r > tExit) {
                    return null;
                }
                if (r > tEnter) {
                    tEnter = r;
                }
            } else {
                if (r < tEnter) {
                    return null;
                }
                if (r < tExit) {
                    tExit = r;
                }
            }
        }
    }

    return [tEnter, tExit];
}

function lerpLatLng(a: L.LatLng, b: L.LatLng, t: number): L.LatLng {
    return new L.LatLng(a.lat + (b.lat - a.lat) * t, a.lng + (b.lng - a.lng) * t);
}

/**
 * Build the coordinate run(s) that represent the portion(s) of a polyline
 * lying inside the selection rectangle. Each maximal run of in-selection
 * vertices becomes one run; where the path crosses the rectangle edge to
 * enter/leave the run, a boundary intersection point is inserted so the new
 * line reaches the edge of the selection area rather than stopping at the last
 * inside vertex.
 */
function buildClippedRuns(
    allLatLngs: L.LatLng[],
    selectedSet: Set<L.LatLng>,
    bounds: L.LatLngBounds
): L.LatLng[][] {
    const n = allLatLngs.length;
    const inside = allLatLngs.map((v) => selectedSet.has(v));
    const runs: L.LatLng[][] = [];

    let i = 0;
    while (i < n) {
        if (!inside[i]) {
            i++;
            continue;
        }

        // Extend the run over consecutive inside vertices.
        let j = i;
        while (j + 1 < n && inside[j + 1]) {
            j++;
        }

        const run: L.LatLng[] = [];

        // Entry point: where segment (i-1 → i) crosses into the rectangle.
        if (i > 0) {
            const params = clipSegmentParams(allLatLngs[i - 1], allLatLngs[i], bounds);
            if (params && params[0] > 0 && params[0] < 1) {
                run.push(lerpLatLng(allLatLngs[i - 1], allLatLngs[i], params[0]));
            }
        }

        for (let k = i; k <= j; k++) {
            run.push(allLatLngs[k]);
        }

        // Exit point: where segment (j → j+1) crosses out of the rectangle.
        if (j < n - 1) {
            const params = clipSegmentParams(allLatLngs[j], allLatLngs[j + 1], bounds);
            if (params && params[1] > 0 && params[1] < 1) {
                run.push(lerpLatLng(allLatLngs[j], allLatLngs[j + 1], params[1]));
            }
        }

        runs.push(run);
        i = j + 1;
    }

    return runs;
}

/**
 * Build the coordinate run(s) that represent the portion(s) of a polyline
 * lying OUTSIDE the selection rectangle — the complement of buildClippedRuns.
 * Each maximal run of out-of-selection vertices becomes one run; where the
 * path crosses the rectangle edge to leave/re-enter the selection, the same
 * boundary intersection point used by buildClippedRuns is inserted so the
 * remaining line reaches the edge of the selection area with no gap between
 * it and the grouped (inside) line.
 */
function buildComplementRuns(
    allLatLngs: L.LatLng[],
    selectedSet: Set<L.LatLng>,
    bounds: L.LatLngBounds
): L.LatLng[][] {
    const n = allLatLngs.length;
    const inside = allLatLngs.map((v) => selectedSet.has(v));
    const runs: L.LatLng[][] = [];

    let i = 0;
    while (i < n) {
        if (inside[i]) {
            i++;
            continue;
        }

        // Extend the run over consecutive outside vertices.
        let j = i;
        while (j + 1 < n && !inside[j + 1]) {
            j++;
        }

        const run: L.LatLng[] = [];

        // Entry point: where segment (i-1 → i) crosses out of the rectangle.
        // The previous vertex is inside, so this is the same boundary point
        // used as the exit point of the preceding inside run.
        if (i > 0) {
            const params = clipSegmentParams(allLatLngs[i - 1], allLatLngs[i], bounds);
            if (params && params[1] > 0 && params[1] < 1) {
                run.push(lerpLatLng(allLatLngs[i - 1], allLatLngs[i], params[1]));
            }
        }

        for (let k = i; k <= j; k++) {
            run.push(allLatLngs[k]);
        }

        // Exit point: where segment (j → j+1) crosses back into the rectangle.
        // The next vertex is inside, so this matches the entry point of the
        // following inside run.
        if (j < n - 1) {
            const params = clipSegmentParams(allLatLngs[j], allLatLngs[j + 1], bounds);
            if (params && params[0] > 0 && params[0] < 1) {
                run.push(lerpLatLng(allLatLngs[j], allLatLngs[j + 1], params[0]));
            }
        }

        runs.push(run);
        i = j + 1;
    }

    return runs;
}

function findMarkerByHistoryId(layerId: string, historyId: string): L.Layer | null {
    const mapStore = useMapStore(pinia);
    const layerDef = mapStore.layers.find((l) => l.id === layerId);
    if (!layerDef) {
        return null;
    }
    let found: L.Layer | null = null;
    layerDef.getLayer().eachLayer((m) => {
        if (getFeatureHistoryId(m) === historyId) {
            found = m as L.Layer;
        }
    });
    return found;
}

function hideMarker(marker: L.Layer): void {
    const isPoint = typeof (marker as any).getLatLng === 'function';
    if (isPoint && typeof (marker as any).setStyle !== 'function') {
        // DivIcon marker (L.Marker) — hide via CSS display.
        const el = (marker as any).getElement?.() as HTMLElement | undefined;
        if (el) {
            hiddenStyles.set(marker as object, { opacity: 1, fillOpacity: 0 });
            el.style.display = 'none';
            currentlyHidden.add(marker);
        }
    } else if (typeof (marker as any).setStyle === 'function') {
        // CircleMarker, Polyline, Polygon — zero-out opacity.
        const opts = (marker as any).options ?? {};
        hiddenStyles.set(marker as object, {
            opacity: typeof opts.opacity === 'number' ? opts.opacity : 1,
            fillOpacity: typeof opts.fillOpacity === 'number' ? opts.fillOpacity : 0
        });
        (marker as any).setStyle({ opacity: 0, fillOpacity: 0 });
        currentlyHidden.add(marker);
    }
}

function showMarker(marker: L.Layer): void {
    const isPoint = typeof (marker as any).getLatLng === 'function';
    if (isPoint && typeof (marker as any).setStyle !== 'function') {
        // DivIcon marker.
        const el = (marker as any).getElement?.() as HTMLElement | undefined;
        if (el) {
            el.style.display = '';
        }
        hiddenStyles.delete(marker as object);
    } else if (typeof (marker as any).setStyle === 'function') {
        const orig = hiddenStyles.get(marker as object);
        if (orig) {
            (marker as any).setStyle({ opacity: orig.opacity, fillOpacity: orig.fillOpacity });
            hiddenStyles.delete(marker as object);
        }
    }
    currentlyHidden.delete(marker);
}

// ── Selection → membership helpers ───────────────────────────────────────

/**
 * Analyse the current selection, detect partially-selected polylines, and
 * open the appropriate dialog.
 * Called when the user clicks the "Group" button in AreaSelectionPanel.
 */
/**
 * Analyse the current selection and split it into fully-selected members and
 * partially-selected polylines that require a split before joining a group.
 * Shared by the create-group and add-to-group flows. Returns null when nothing
 * is selected.
 */
function computeSelectionMembership(): {
    fullMembers: GroupMember[];
    partialSplits: PartialPolylineSplit[];
} | null {
    const selectionStore = useSelectionStore(pinia);
    const mapStore = useMapStore(pinia);

    const selected = selectionStore.selected;
    if (selected.length === 0) {
        return null;
    }

    // Group SelectedMarker entries by their Leaflet layer reference.
    const byMarker = new Map<object, typeof selected>();
    for (const entry of selected) {
        const key = entry.marker as object;
        if (!byMarker.has(key)) {
            byMarker.set(key, []);
        }
        byMarker.get(key)!.push(entry);
    }

    const fullMembers: GroupMember[] = [];
    const partialSplits: PartialPolylineSplit[] = [];

    for (const [, entries] of byMarker) {
        const first = entries[0];
        if (!first.historyId) {
            continue;
        }

        const marker = first.marker;
        const layerDef = mapStore.layers.find((l) => l.id === first.layerId);

        if (layerDef?.kind === 'polyline') {
            const allLatLngs = getPolylineLatLngs(marker);
            const selectedLatLngs = entries.map((e) => e.latLng);

            if (selectedLatLngs.length < allLatLngs.length) {
                // Partial selection — must split before grouping.
                partialSplits.push({
                    layerId: first.layerId,
                    layerTitle: layerDef.title,
                    marker,
                    selectedLatLngs,
                    allLatLngs,
                    clipBounds: selectionStore.lastAreaBounds ?? null
                });
            } else {
                fullMembers.push({ layerId: first.layerId, historyId: first.historyId });
            }
        } else {
            // Point or polygon — always a full selection.
            fullMembers.push({ layerId: first.layerId, historyId: first.historyId });
        }
    }

    return { fullMembers, partialSplits };
}

export function createGroupFromSelection(): void {
    const groupStore = useGroupStore(pinia);

    const membership = computeSelectionMembership();
    if (!membership) {
        return;
    }

    groupStore.setPendingGroupMembers(membership.fullMembers);
    groupStore.setAddToGroupId(null);

    if (membership.partialSplits.length > 0) {
        groupStore.openSplitDialog(membership.partialSplits);
    } else {
        groupStore.openNameDialog();
    }
}

/**
 * Group-first entry point: begin adding features to an existing group. Marks
 * the group as the add target and activates area-selection so the user can
 * rubber-band (or additively click) the features to add. Confirming via the
 * selection toolbar routes through addSelectionToGroup().
 */
export function beginAddToGroup(groupId: string): void {
    const groupStore = useGroupStore(pinia);
    const selectionStore = useSelectionStore(pinia);

    groupStore.setAddToGroupId(groupId);
    if (!selectionStore.isActive) {
        selectionStore.activate();
    }
}

/**
 * Add the current selection to an existing group. Mirrors createGroupFromSelection
 * but, instead of creating a new group, folds the selected features into
 * `groupId`. Partially-selected polylines still trigger the split dialog; the
 * split routing (executeSplitsAndProceed / skipSplitsAndProceed) detects the
 * add-target and finalises the add rather than opening the name dialog.
 */
export function addSelectionToGroup(groupId: string): void {
    const groupStore = useGroupStore(pinia);

    const membership = computeSelectionMembership();
    if (!membership) {
        return;
    }

    groupStore.setPendingGroupMembers(membership.fullMembers);
    groupStore.setAddToGroupId(groupId);

    if (membership.partialSplits.length > 0) {
        groupStore.openSplitDialog(membership.partialSplits);
    } else {
        finalizeAddToGroup();
    }
}

/**
 * Finalise adding the pending members (plus any split lines) to the target
 * group in a single checkpoint, then clear state and close the selection.
 */
export function finalizeAddToGroup(): void {
    const groupStore = useGroupStore(pinia);
    const mapStore = useMapStore(pinia);

    const targetGroupId = groupStore.addToGroupId;
    if (!targetGroupId) {
        return;
    }

    const splitMembers = performPendingSplits();
    const members = [...groupStore.pendingGroupMembers, ...splitMembers];

    groupStore.addMembersToGroup(targetGroupId, members);
    groupStore.clearPendingState();

    // Newly added members must honour the target group's current visibility.
    recomputeFeatureVisibility();

    // Close the selection pop-up now the add is complete.
    useSelectionStore(pinia).deactivate();

    mapStore.markLayerUpdated();
}

/**
 * Perform the pending polyline splits. Called by finalizeCreateGroup so the
 * geometry mutation and the resulting group creation land in a single
 * markLayerUpdated() checkpoint. Deferring the split until the group is
 * confirmed means cancelling the name dialog leaves the map untouched.
 *
 * Returns the GroupMember entries for the newly-created split lines.
 */
function performPendingSplits(): GroupMember[] {
    const groupStore = useGroupStore(pinia);
    const mapStore = useMapStore(pinia);

    const splits: PartialPolylineSplit[] = [...groupStore.pendingSplits];
    const newMembers: GroupMember[] = [];

    for (const split of splits) {
        const layerDef = mapStore.layers.find((l) => l.id === split.layerId);
        if (!layerDef) {
            continue;
        }

        const geoJsonLayer = layerDef.getLayer();
        const selectedSet = new Set<L.LatLng>(split.selectedLatLngs);

        // Helper: create a fresh polyline feature for one coordinate run and
        // return its history id. Recreating both halves as new lines (rather
        // than trimming the original in place) avoids leaving stale geometry,
        // edit handlers, or cached features on the original marker.
        const createLineFromRun = (run: L.LatLng[]): string => {
            const historyId = buildHistoryId('polyline');
            const feature: GeoJSON.Feature = {
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: run.map((ll: L.LatLng) => [ll.lng, ll.lat])
                },
                properties: { historyId }
            };
            layerDef.loadFromGeoJSON({
                type: 'FeatureCollection',
                features: [feature]
            } as any);
            return historyId;
        };

        // Build the grouped (inside-selection) run(s). When the selection
        // rectangle is known, clip the polyline to it so each new line extends
        // to where it crosses the rectangle edge (adding boundary points).
        // Otherwise fall back to just the selected vertices.
        const insideRuns = (
            split.clipBounds
                ? buildClippedRuns(split.allLatLngs, selectedSet, split.clipBounds)
                : split.selectedLatLngs.length >= 2
                  ? [split.selectedLatLngs]
                  : []
        ).filter((run) => run.length >= 2);

        // Build the remaining (outside-of-selection) run(s). When the selection
        // rectangle is known, extend each run to where the polyline crosses the
        // rectangle edge (inserting the same boundary points as the grouped
        // line) so the remaining line reaches the split point with no gap.
        // Otherwise fall back to the raw outside vertices as a single run.
        const remainingRuns = (
            split.clipBounds
                ? buildComplementRuns(split.allLatLngs, selectedSet, split.clipBounds)
                : [split.allLatLngs.filter((v: L.LatLng) => !selectedSet.has(v))]
        ).filter((run) => run.length >= 2);

        // Remove the original polyline. Both the grouped portion(s) and the
        // remaining portion(s) are recreated below as independent lines so the
        // original never lingers on the map with its full geometry.
        geoJsonLayer.removeLayer(split.marker as L.Layer);

        // Create the new grouped line(s) — these join the group.
        for (const run of insideRuns) {
            const newHistoryId = createLineFromRun(run);
            newMembers.push({ layerId: split.layerId, historyId: newHistoryId });
        }

        // Create the remaining (ungrouped) line(s) so the sections of the
        // original line outside the selection stay on the map as their own
        // lines, each reaching the edge of the selection area.
        for (const run of remainingRuns) {
            createLineFromRun(run);
        }
    }

    return newMembers;
}

/**
 * Called from PartialPolylineDialog when the user accepts splitting.
 * The actual split is deferred until the group is confirmed (finalizeCreateGroup)
 * so cancelling the name dialog does not mutate the map. pendingSplits is kept.
 */
export function executeSplitsAndProceed(): void {
    const groupStore = useGroupStore(pinia);
    groupStore.approveSplitDialog();
    if (groupStore.addToGroupId) {
        finalizeAddToGroup();
    } else {
        groupStore.openNameDialog();
    }
}

/**
 * Called from PartialPolylineDialog when the user declines splitting.
 * Discards the pending splits and proceeds without the partial polylines.
 */
export function skipSplitsAndProceed(): void {
    const groupStore = useGroupStore(pinia);
    groupStore.closeSplitDialog();
    if (groupStore.addToGroupId) {
        finalizeAddToGroup();
    } else {
        groupStore.openNameDialog();
    }
}

/**
 * Called from GroupNameDialog on save (create mode).
 * Performs any approved polyline splits, creates the group, and triggers a
 * single snapshot checkpoint covering both the split and the new group.
 */
export function finalizeCreateGroup(name: string): void {
    if (!name.trim()) {
        return;
    }

    const groupStore = useGroupStore(pinia);
    const mapStore = useMapStore(pinia);

    const splitMembers = performPendingSplits();
    const id = buildHistoryId('group');
    const members = [...groupStore.pendingGroupMembers, ...splitMembers];

    groupStore.addGroup({ id, name: name.trim(), members });
    groupStore.clearPendingState();
    groupStore.closeNameDialog();

    // Close the area-selection pop-up now that the group exists: deactivating
    // clears the selection and hides the AreaSelectionPanel.
    useSelectionStore(pinia).deactivate();

    mapStore.markLayerUpdated();
}

/**
 * Called from GroupNameDialog on save (rename mode).
 */
export function finalizeRenameGroup(id: string, name: string): void {
    if (!name.trim()) {
        return;
    }

    const groupStore = useGroupStore(pinia);
    const mapStore = useMapStore(pinia);

    groupStore.renameGroup(id, name.trim());
    groupStore.closeNameDialog();

    mapStore.markLayerUpdated();
}

/**
 * Select all members of a group and fit the map to show them all.
 */
export function selectGroup(id: string): void {
    const groupStore = useGroupStore(pinia);
    const mapStore = useMapStore(pinia);
    const selectionStore = useSelectionStore(pinia);

    const group = groupStore.groups.find((g) => g.id === id);
    if (!group || group.members.length === 0) {
        return;
    }

    // Build SelectedMarker entries for every member, handling both point
    // markers (getLatLng) and polyline/polygon features (getLatLngs).
    const allEntries: SelectedMarker[] = [];

    for (const member of group.members) {
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
        return;
    }

    // Track the group's members as the current selection and highlight them,
    // but do NOT enter area-selection mode. Selecting a group should only
    // reveal it; if the user wants to add to the group they can activate the
    // selection tool themselves.
    selectionStore.setSelected(allEntries);

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

    applySelectionHighlights(allEntries, true);
}

/**
 * Delete a group AND all its member features from the map.
 * This is undoable via the snapshot journal.
 */
export function deleteGroupWithElements(id: string): void {
    const groupStore = useGroupStore(pinia);
    const mapStore = useMapStore(pinia);

    const group = groupStore.groups.find((g) => g.id === id);
    if (!group) {
        return;
    }

    // Restore visibility for any hidden members before removing them.
    for (const member of group.members) {
        const marker = findMarkerByHistoryId(member.layerId, member.historyId);
        if (marker && hiddenStyles.has(marker as object)) {
            showMarker(marker);
        }
    }

    // Remove each member feature from its layer.
    const seen = new Set<string>();
    for (const member of group.members) {
        const key = `${member.layerId}:${member.historyId}`;
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);

        const marker = findMarkerByHistoryId(member.layerId, member.historyId);
        const layerDef = mapStore.layers.find((l) => l.id === member.layerId);
        if (marker && layerDef) {
            layerDef.getLayer().removeLayer(marker as L.Layer);
        }
    }

    groupStore.removeGroup(id);
    // Clear any lingering highlights from having selected this group.
    clearFeatureHighlight();
    mapStore.markLayerUpdated();
}

/**
 * Remove all members from a group (elements stay on the map).
 * Undoable via the snapshot journal.
 */
export function removeAllGroupElements(id: string): void {
    const groupStore = useGroupStore(pinia);
    const mapStore = useMapStore(pinia);
    groupStore.clearGroupMembers(id);
    // Clear any lingering highlights from having selected this group.
    clearFeatureHighlight();
    // Members removed from the group may no longer be hidden by any group.
    recomputeFeatureVisibility();
    mapStore.markLayerUpdated();
}

/**
 * Delete a group WITHOUT deleting its member features (the elements remain on
 * the map, just ungrouped). Undoable. Used both for the "delete group only"
 * choice and after removeAllGroupElements when the user confirms deletion of a
 * now-empty group.
 */
export function deleteGroup(id: string): void {
    const groupStore = useGroupStore(pinia);
    const mapStore = useMapStore(pinia);
    groupStore.removeGroup(id);
    // Clear any lingering highlights from having selected this group so its
    // (now ungrouped) elements are not left looking selected.
    clearFeatureHighlight();
    // Removing the group may leave formerly-hidden members visible again.
    recomputeFeatureVisibility();
    mapStore.markLayerUpdated();
}

/**
 * Toggle a group's visibility. Runtime only — not persisted, not undoable.
 */
export function toggleGroupVisibility(id: string): void {
    const groupStore = useGroupStore(pinia);
    groupStore.toggleHidden(id);
    recomputeFeatureVisibility();
}

/**
 * Show or hide ALL groups at once. Runtime only — not undoable.
 */
export function setAllGroupsVisibility(hidden: boolean): void {
    const groupStore = useGroupStore(pinia);
    groupStore.setAllHidden(hidden);
    recomputeFeatureVisibility();
}

/**
 * Prune group members whose underlying feature no longer exists on the map
 * (e.g. deleted via area-select, popup delete, or an individual marker click).
 *
 * Returns true if any member was removed. Called from the save pipeline and on
 * map load so groups do not retain dangling references. Because it runs before
 * the snapshot checkpoint is taken, the prune is folded into the same undo step
 * as the deletion that caused it, keeping undo/redo consistent.
 */
export function pruneDanglingGroupMembers(): boolean {
    const groupStore = useGroupStore(pinia);
    const mapStore = useMapStore(pinia);

    if (groupStore.groups.length === 0) {
        return false;
    }

    // Build the set of (layerId:historyId) keys that currently exist.
    const existing = new Set<string>();
    for (const layer of mapStore.layers) {
        layer.getLayer().eachLayer((m) => {
            const historyId = getFeatureHistoryId(m);
            if (historyId) {
                existing.add(`${layer.id}:${historyId}`);
            }
        });
    }

    let changed = false;
    const nextGroups = groupStore.groups.map((group) => {
        const kept = group.members.filter((member) =>
            existing.has(`${member.layerId}:${member.historyId}`)
        );
        if (kept.length !== group.members.length) {
            changed = true;
            return { ...group, members: kept };
        }
        return group;
    });

    if (changed) {
        groupStore.setGroups(nextGroups);
    }
    return changed;
}
