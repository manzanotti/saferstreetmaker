/**
 * Tests for useGroups — saving modified group selections and version switching.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia } from 'pinia';

vi.mock('leaflet', () => import('./__mocks__/leaflet'));

import { pinia } from '../../src/stores/index';
import { useGroupStore } from '../../src/stores/groupStore';
import { useMapStore } from '../../src/stores/mapStore';
import { useUiStore } from '../../src/stores/uiStore';
import { useSelectionStore } from '../../src/stores/selectionStore';
import { useFeatureDeletionStore } from '../../src/stores/featureDeletionStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import {
    saveGroupSelection,
    saveGroupSelectionWhileEditing,
    switchGroupVersion,
    openGroupDetails
} from '../../src/composables/useGroups';
import { makePointLayer, makePointMarker, makeSelected } from './useGroups.helpers';

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

    it('saves a modified group selection and closes selection mode', () => {
        const layer = makePointLayer('ModalFilters');
        const marker = makePointMarker('hist-1');
        layer.getLayer().addLayer(marker as any);
        useMapStore(pinia).setLayers([layer]);

        const groupStore = useGroupStore(pinia);
        groupStore.addGroup({
            id: 'g1',
            name: 'G',
            members: [
                { layerId: 'ModalFilters', historyId: 'hist-1' },
                { layerId: 'ModalFilters', historyId: 'hist-2' }
            ]
        });
        const selectionStore = useSelectionStore(pinia);
        selectionStore.markGroupSelection('g1');
        selectionStore.activate();
        selectionStore.setSelected([makeSelected('ModalFilters', 'hist-1', marker)]);
        selectionStore.markGroupSelection('g1');

        const markSpy = vi.spyOn(useMapStore(pinia), 'markLayerUpdated');
        saveGroupSelection();

        expect(groupStore.groups[0].members).toEqual([
            { layerId: 'ModalFilters', historyId: 'hist-1' }
        ]);
        expect(selectionStore.isActive).toBe(false);
        expect(markSpy).toHaveBeenCalledOnce();
    });

    it('saves a modified group selection while keeping group editing active', () => {
        const layer = makePointLayer('ModalFilters');
        const marker = makePointMarker('hist-1');
        layer.getLayer().addLayer(marker as any);
        useMapStore(pinia).setLayers([layer]);

        const groupStore = useGroupStore(pinia);
        groupStore.addGroup({
            id: 'g1',
            name: 'G',
            members: [
                { layerId: 'ModalFilters', historyId: 'hist-1' },
                { layerId: 'ModalFilters', historyId: 'hist-2' }
            ]
        });
        const selectionStore = useSelectionStore(pinia);
        selectionStore.setSelected([makeSelected('ModalFilters', 'hist-1', marker)]);
        selectionStore.markGroupSelection('g1');

        saveGroupSelectionWhileEditing();

        expect(groupStore.groups[0].members).toEqual([
            { layerId: 'ModalFilters', historyId: 'hist-1' }
        ]);
        expect(selectionStore.isGroupSelection).toBe(true);
        expect(selectionStore.selectedGroupId).toBe('g1');
    });

    it('switches versions without persisting the transient cleared selection', () => {
        const layer = makePointLayer('ModalFilters');
        const firstMarker = makePointMarker('first-feature');
        const secondMarker = makePointMarker('second-feature');
        layer.getLayer().addLayer(firstMarker as any);
        layer.getLayer().addLayer(secondMarker as any);
        useMapStore(pinia).setLayers([layer]);

        const groupStore = useGroupStore(pinia);
        groupStore.setGroups([
            {
                id: 'g1',
                name: 'Versioned group',
                defaultVersionId: 'v1',
                versions: [
                    {
                        id: 'v1',
                        name: 'First',
                        members: [{ layerId: 'ModalFilters', historyId: 'first-feature' }]
                    },
                    {
                        id: 'v2',
                        name: 'Second',
                        members: [{ layerId: 'ModalFilters', historyId: 'second-feature' }]
                    }
                ]
            }
        ]);
        openGroupDetails('g1');

        expect(switchGroupVersion('g1', 'v2')).toBe(true);

        const versions = groupStore.groups[0].versions ?? [];
        expect(versions.find((version) => version.id === 'v1')?.members).toEqual([
            { layerId: 'ModalFilters', historyId: 'first-feature' }
        ]);
        expect(versions.find((version) => version.id === 'v2')?.members).toEqual([
            { layerId: 'ModalFilters', historyId: 'second-feature' }
        ]);
        expect(groupStore.detailsGroupId).toBe('g1');
        expect(useSelectionStore(pinia).selected.map((entry) => entry.historyId)).toEqual([
            'second-feature'
        ]);
    });

    it('asks whether to delete a group when saving removes its final member', () => {
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
        const selectionStore = useSelectionStore(pinia);
        selectionStore.activate();
        selectionStore.setSelected([]);
        selectionStore.markGroupSelection('g1');

        saveGroupSelection();

        expect(groupStore.groups[0].members).toHaveLength(0);
        expect(groupStore.pendingEmptyGroupDeletionId).toBe('g1');
        expect(useUiStore(pinia).activePanel).toBe('groups');
    });
});
