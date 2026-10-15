import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { watch } from 'vue';
import * as L from 'leaflet';
import { useSelectionStore, type SelectedMarker } from '../../../src/stores/selectionStore';

describe('selection reset transitions', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
    });

    for (const action of ['clear', 'deactivate', 'setSelected'] as const) {
        it(`${action} leaves group editing before notifying synchronous selection watchers`, () => {
            const store = useSelectionStore();
            const latLng = L.latLng(52.5, -1.9);
            const entry: SelectedMarker = {
                layerId: 'ModalFilters',
                historyId: 'filter-1',
                latLng,
                marker: L.circleMarker(latLng)
            };
            store.setSelected([entry]);
            store.markGroupSelection('group-1');
            store.setPhaseEditing(true);
            store.activate();

            const observedStates: unknown[] = [];
            const stop = watch(
                () => store.selected,
                () => {
                    observedStates.push({
                        isGroupSelection: store.isGroupSelection,
                        selectedGroupId: store.selectedGroupId,
                        isPhaseEditing: store.isPhaseEditing
                    });
                },
                { flush: 'sync' }
            );
            try {
                if (action === 'setSelected') {
                    store.setSelected([{ ...entry, historyId: 'filter-2' }]);
                } else {
                    store[action]();
                }
                expect(observedStates).toEqual([
                    {
                        isGroupSelection: false,
                        selectedGroupId: null,
                        isPhaseEditing: action === 'clear'
                    }
                ]);
            } finally {
                stop();
            }
        });
    }
});
