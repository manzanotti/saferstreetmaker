/**
 * Tests for useGroups — confirmFeatureDeletion().
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia } from 'pinia';

vi.mock('leaflet', () => import('./__mocks__/leaflet'));

import * as L from 'leaflet';
import { pinia } from '../../src/stores/index';
import { useGroupStore } from '../../src/stores/groupStore';
import { useMapStore } from '../../src/stores/mapStore';
import { useSelectionStore } from '../../src/stores/selectionStore';
import { useFeatureDeletionStore } from '../../src/stores/featureDeletionStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { confirmFeatureDeletion } from '../../src/composables/useFeatureDeletion';
import { makePolylineLayer, makePolylineMarker } from './useGroups.helpers';

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

    describe('confirmFeatureDeletion()', () => {
        const member = { layerId: 'MobilityLanes', historyId: 'shared-line' };

        function setupGroupedLine() {
            const layer = makePolylineLayer('MobilityLanes');
            const marker = makePolylineMarker('shared-line', [
                { lat: 1, lng: 1 } as L.LatLng,
                { lat: 2, lng: 2 } as L.LatLng
            ]);
            layer.getLayer().addLayer(marker);
            useMapStore(pinia).setLayers([layer]);
            useGroupStore(pinia).setGroups([
                {
                    id: 'g1',
                    name: 'Town centre',
                    defaultVersionId: 'v1',
                    versions: [
                        { id: 'v1', name: 'Current', members: [member] },
                        { id: 'v2', name: 'Alternative', members: [{ ...member }] }
                    ]
                },
                { id: 'g2', name: 'School route', members: [{ ...member }] }
            ]);
            useFeatureDeletionStore(pinia).open({
                ...member,
                memberships: [
                    {
                        groupId: 'g1',
                        groupName: 'Town centre',
                        versionId: 'v1',
                        versionName: 'Current',
                        isActive: true
                    },
                    {
                        groupId: 'g1',
                        groupName: 'Town centre',
                        versionId: 'v2',
                        versionName: 'Alternative',
                        isActive: false
                    },
                    {
                        groupId: 'g2',
                        groupName: 'School route',
                        versionId: 'g2:default',
                        versionName: 'Default',
                        isActive: true
                    }
                ]
            });
            return { layer, marker };
        }

        it('removes the line only from the selected version', () => {
            const { layer, marker } = setupGroupedLine();

            expect(confirmFeatureDeletion('version')).toBe(true);

            const groups = useGroupStore(pinia).groups;
            expect(groups[0].versions?.[0].members).toEqual([]);
            expect(groups[0].versions?.[1].members).toEqual([member]);
            expect(groups[1].members).toEqual([member]);
            expect(layer.getLayer().getLayers()).toContain(marker);
        });

        it('removes the line from every version of the selected group only', () => {
            const { layer, marker } = setupGroupedLine();

            expect(confirmFeatureDeletion('group')).toBe(true);

            const groups = useGroupStore(pinia).groups;
            expect(groups[0].versions?.every((version) => version.members.length === 0)).toBe(true);
            expect(groups[1].members).toEqual([member]);
            expect(layer.getLayer().getLayers()).toContain(marker);
        });

        it('deletes the line and removes it from every group version', () => {
            const { layer } = setupGroupedLine();

            expect(confirmFeatureDeletion('everything')).toBe(true);

            expect(
                useGroupStore(pinia).groups.every((group) =>
                    (group.versions ?? []).every((version) => version.members.length === 0)
                )
            ).toBe(true);
            expect(layer.getLayer().getLayers()).toEqual([]);
        });

        it('immediately removes unassigned memberships everywhere while preserving other members', () => {
            const { layer } = setupGroupedLine();
            const groupStore = useGroupStore(pinia);
            const otherMember = { layerId: 'MobilityLanes', historyId: 'other-line' };
            groupStore.addGroup({
                id: 'g3',
                name: 'Retained features',
                versions: [{ id: 'v3', name: 'Current', members: [] }],
                unassignedMembers: [member, otherMember]
            });
            expect(groupStore.getFeatureGroupMemberships(member)).toHaveLength(3);

            expect(confirmFeatureDeletion('everything')).toBe(true);

            expect(groupStore.groups.find((group) => group.id === 'g3')?.unassignedMembers).toEqual(
                [otherMember]
            );
            expect(groupStore.getFeatureGroupMemberships(member)).toEqual([]);
            expect(groupStore.getFeatureMemberships(member)).toEqual([]);
            expect(groupStore.getFeatureGroupMemberships(otherMember)).toMatchObject([
                { groupId: 'g3' }
            ]);
            expect(layer.getLayer().getLayers()).toEqual([]);
        });
    });
});
