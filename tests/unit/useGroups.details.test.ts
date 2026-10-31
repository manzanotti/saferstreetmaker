/**
 * Tests for useGroups — group colour/description/details edits and removeFeatureFromGroup().
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
    applyGroupColor,
    applyGroupDescription,
    applyGroupDetails,
    removeFeatureFromGroup
} from '../../src/composables/useGroups';

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

    describe('applyGroupColor()', () => {
        it('returns false for an unknown group or invalid colour without persisting', () => {
            const mapStore = useMapStore(pinia);
            const markSpy = vi.spyOn(mapStore, 'markLayerUpdated');
            const groupStore = useGroupStore(pinia);
            groupStore.addGroup({ id: 'g1', name: 'Group', color: '#00aa00', members: [] });

            expect(applyGroupColor('missing', '#aa0000')).toBe(false);
            expect(applyGroupColor('g1', 'not-a-colour')).toBe(false);
            expect(groupStore.groups[0].color).toBe('#00aa00');
            expect(markSpy).not.toHaveBeenCalled();
        });

        it('returns false when the normalized colour is unchanged', () => {
            const mapStore = useMapStore(pinia);
            const markSpy = vi.spyOn(mapStore, 'markLayerUpdated');
            useGroupStore(pinia).addGroup({
                id: 'g1',
                name: 'Group',
                color: '#00aa00',
                members: []
            });

            expect(applyGroupColor('g1', '#00AA00')).toBe(false);
            expect(markSpy).not.toHaveBeenCalled();
        });

        it('normalizes a valid colour, updates the group, and persists once', () => {
            const mapStore = useMapStore(pinia);
            const markSpy = vi.spyOn(mapStore, 'markLayerUpdated');
            useGroupStore(pinia).addGroup({ id: 'g1', name: 'Group', members: [] });

            expect(applyGroupColor('g1', '#0a5')).toBe(true);
            expect(useGroupStore(pinia).groups[0].color).toBe('#00aa55');
            expect(markSpy).toHaveBeenCalledOnce();
        });
    });

    describe('applyGroupDescription()', () => {
        it('updates a group description and creates one map checkpoint', () => {
            const groupStore = useGroupStore(pinia);
            const mapStore = useMapStore(pinia);
            groupStore.addGroup({ id: 'g1', name: 'Group', members: [] });
            const markLayerUpdated = vi.spyOn(mapStore, 'markLayerUpdated');

            expect(applyGroupDescription('g1', '<p>Notes</p>')).toBe(true);
            expect(groupStore.groups[0].description).toBe('<p>Notes</p>');
            expect(markLayerUpdated).toHaveBeenCalledTimes(1);
        });

        it('does not checkpoint an unchanged description', () => {
            const groupStore = useGroupStore(pinia);
            const mapStore = useMapStore(pinia);
            groupStore.addGroup({
                id: 'g1',
                name: 'Group',
                description: '<p>Notes</p>',
                members: []
            });
            const markLayerUpdated = vi.spyOn(mapStore, 'markLayerUpdated');

            expect(applyGroupDescription('g1', '<p onclick="bad()">Notes</p>')).toBe(false);
            expect(markLayerUpdated).not.toHaveBeenCalled();
        });
    });

    describe('applyGroupDetails()', () => {
        it('updates normalized metadata in one checkpoint', () => {
            const groupStore = useGroupStore(pinia);
            groupStore.addGroup({
                id: 'g1',
                name: 'Old name',
                color: '#00ff00',
                description: 'Old description',
                members: []
            });
            const markSpy = vi.spyOn(useMapStore(pinia), 'markLayerUpdated');

            expect(applyGroupDetails('g1', '  New name  ', '#ABC', '<p>New description</p>')).toBe(
                true
            );

            expect(groupStore.groups[0]).toMatchObject({
                name: 'New name',
                color: '#aabbcc',
                description: '<p>New description</p>'
            });
            expect(markSpy).toHaveBeenCalledOnce();
        });

        it('does not checkpoint unchanged or invalid metadata', () => {
            const groupStore = useGroupStore(pinia);
            groupStore.addGroup({ id: 'g1', name: 'Group', color: '#00ff00', members: [] });
            const markSpy = vi.spyOn(useMapStore(pinia), 'markLayerUpdated');

            expect(applyGroupDetails('g1', 'Group', '#00ff00', '')).toBe(false);
            expect(applyGroupDetails('missing', 'Group', '#00ff00', '')).toBe(false);
            expect(markSpy).not.toHaveBeenCalled();
        });
    });

    describe('removeFeatureFromGroup()', () => {
        it('removes the feature from every version in the selected group', () => {
            const member = { layerId: 'MobilityLanes', historyId: 'line-1' };
            const otherMember = { layerId: 'MobilityLanes', historyId: 'line-2' };
            const mapStore = useMapStore(pinia);
            const markLayerUpdated = vi.spyOn(mapStore, 'markLayerUpdated');

            useGroupStore(pinia).setGroups([
                {
                    id: 'g1',
                    name: 'Town centre',
                    defaultVersionId: 'v1',
                    versions: [
                        { id: 'v1', name: 'Current', members: [member, otherMember] },
                        { id: 'v2', name: 'Alternative', members: [{ ...member }] }
                    ]
                },
                { id: 'g2', name: 'School route', members: [{ ...member }] }
            ]);

            expect(removeFeatureFromGroup('g1', member)).toBe(true);
            expect(useGroupStore(pinia).groups).toEqual([
                {
                    id: 'g1',
                    name: 'Town centre',
                    defaultVersionId: 'v1',
                    versions: [
                        { id: 'v1', name: 'Current', members: [otherMember] },
                        { id: 'v2', name: 'Alternative', members: [] }
                    ],
                    members: [otherMember]
                },
                { id: 'g2', name: 'School route', members: [{ ...member }] }
            ]);
            expect(markLayerUpdated).toHaveBeenCalledTimes(1);
        });

        it('does not checkpoint when the group or feature membership is absent', () => {
            const markLayerUpdated = vi.spyOn(useMapStore(pinia), 'markLayerUpdated');
            expect(
                removeFeatureFromGroup('missing', {
                    layerId: 'ModalFilters',
                    historyId: 'missing'
                })
            ).toBe(false);
            expect(markLayerUpdated).not.toHaveBeenCalled();
        });
    });
});
