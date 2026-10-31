/**
 * Tests for useGroups — group visibility toggling and recomputation.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia } from 'pinia';

vi.mock('leaflet', () => import('./__mocks__/leaflet'));

import { pinia } from '../../src/stores/index';
import { useGroupStore } from '../../src/stores/groupStore';
import { useMapStore } from '../../src/stores/mapStore';
import { useSelectionStore } from '../../src/stores/selectionStore';
import { useFeatureDeletionStore } from '../../src/stores/featureDeletionStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import {
    removeAllGroupElements,
    toggleGroupVisibility,
    setAllGroupsVisibility,
    resetGroupVisibility,
    deleteGroup
} from '../../src/composables/useGroups';
import { makePointLayer, makeStyledMarker } from './useGroups.helpers';

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
        useFeatureDeletionStore(pinia).close();
        useSelectionStore(pinia).deactivate();
        useMapStore(pinia).setLayers([]);
        useSettingsStore(pinia).readOnly = false;
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
});
