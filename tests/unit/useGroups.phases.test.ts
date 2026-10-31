/**
 * Tests for useGroups — selection presentation and phase editing safeguards.
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
    toggleGroupVisibility,
    openGroupPhases,
    focusGroupPhase,
    refreshGroupPhasePresentation,
    startNewGroupPhase,
    reorderGroupPhases
} from '../../src/composables/useGroups';
import type { SelectionHighlighter } from '../../src/features/selection/SelectionHighlighter';
import {
    setSelectionHighlighter,
    releaseSelectionHighlighter
} from '../../src/features/selection/featureSelection';
import {
    makePointLayer,
    makePointMarker,
    makeSelected,
    makeStyledMarker
} from './useGroups.helpers';

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

    it('rebuilds active selection presentation across visibility changes without mutating selection', () => {
        const marker = makeStyledMarker('member');
        const layer = makePointLayer('ModalFilters');
        layer.getLayer().addLayer(marker);
        useMapStore(pinia).setLayers([layer]);
        useGroupStore(pinia).setGroups([
            { id: 'g1', name: 'One', members: [{ layerId: 'ModalFilters', historyId: 'member' }] }
        ]);
        const selectionStore = useSelectionStore(pinia);
        selectionStore.activate();
        selectionStore.setSelected([makeSelected('ModalFilters', 'member', marker)]);
        const selection = selectionStore.selected;
        const replace = vi.fn();
        const highlighter = { replace } as unknown as SelectionHighlighter;
        setSelectionHighlighter(highlighter);
        try {
            toggleGroupVisibility('g1');
            expect(marker.options.opacity).toBe(0);
            toggleGroupVisibility('g1');
            expect(marker.options.opacity).toBe(1);
            toggleGroupVisibility('g1');
            expect(replace).toHaveBeenCalledTimes(3);
            expect(replace).toHaveBeenLastCalledWith(selection, selection);
            expect(selectionStore.selected).toBe(selection);
            expect(selectionStore.isActive).toBe(true);
        } finally {
            releaseSelectionHighlighter(highlighter);
            selectionStore.deactivate();
            selectionStore.clear();
        }
    });

    describe('phase editing safeguards', () => {
        it('does not persist selected features outside the phase version', () => {
            const layer = makePointLayer('ModalFilters');
            const memberMarker = makePointMarker('member');
            const unrelatedMarker = makePointMarker('unrelated');
            layer.getLayer().addLayer(memberMarker as any);
            layer.getLayer().addLayer(unrelatedMarker as any);
            useMapStore(pinia).setLayers([layer]);

            const groupStore = useGroupStore(pinia);
            groupStore.setGroups([
                {
                    id: 'g1',
                    name: 'Group',
                    versions: [
                        {
                            id: 'v1',
                            name: 'Default',
                            members: [{ layerId: 'ModalFilters', historyId: 'member' }],
                            phases: [
                                {
                                    id: 'phase-1',
                                    members: [{ layerId: 'ModalFilters', historyId: 'member' }]
                                }
                            ]
                        }
                    ]
                }
            ]);
            groupStore.openPhasesDialog('g1', 'v1');
            expect(focusGroupPhase('phase-1')).toBe(true);
            useSelectionStore(pinia).setSelected([
                makeSelected('ModalFilters', 'member', memberMarker),
                makeSelected('ModalFilters', 'unrelated', unrelatedMarker)
            ]);

            refreshGroupPhasePresentation();

            expect(groupStore.groups[0].versions?.[0].phases?.[0].members).toEqual([
                { layerId: 'ModalFilters', historyId: 'member' }
            ]);
        });

        it('blocks phase creation, opening, and reordering in read-only mode', () => {
            const groupStore = useGroupStore(pinia);
            groupStore.setGroups([
                {
                    id: 'g1',
                    name: 'Group',
                    versions: [
                        {
                            id: 'v1',
                            name: 'Default',
                            members: [{ layerId: 'ModalFilters', historyId: 'member' }],
                            phases: [
                                { id: 'phase-1', members: [] },
                                { id: 'phase-2', members: [] }
                            ]
                        }
                    ]
                }
            ]);
            useSettingsStore(pinia).readOnly = true;

            expect(openGroupPhases('g1', 'v1')).toBe(false);
            groupStore.openPhasesDialog('g1', 'v1');
            expect(startNewGroupPhase()).toBe(false);
            expect(reorderGroupPhases(['phase-2', 'phase-1'])).toBe(false);
            expect(groupStore.groups[0].versions?.[0].phases?.map((phase) => phase.id)).toEqual([
                'phase-1',
                'phase-2'
            ]);
        });
    });
});
