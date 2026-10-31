/**
 * Tests for useGroups — LTN polygon membership across group versions.
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
import {
    saveGroupSelection,
    recomputeFeatureVisibility,
    switchGroupVersion
} from '../../src/composables/useGroups';
import { makePointLayer } from './useGroups.helpers';

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

    it('removes an LTN polygon only from the active group version', () => {
        const layer = { ...makePointLayer('LtnCells'), kind: 'polygon' as const };
        const secondPolygonElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const firstPolygon = {
            properties: { historyId: 'polygon-v1' },
            getLatLngs: () => [[{ lat: 1, lng: 1 }]],
            options: { opacity: 1, fillOpacity: 0.5, color: '#cc00cc' },
            setStyle: vi.fn(function (this: any, style: object) {
                Object.assign(this.options, style);
            })
        } as unknown as L.Layer;
        const secondPolygon = {
            properties: { historyId: 'polygon-v2' },
            getLatLngs: () => [[{ lat: 2, lng: 2 }]],
            options: { opacity: 1, fillOpacity: 0.5, color: '#cc00cc' },
            getElement: () => secondPolygonElement,
            setStyle: vi.fn(function (this: any, style: object) {
                Object.assign(this.options, style);
            })
        } as unknown as L.Layer;
        layer.getLayer().addLayer(firstPolygon as any);
        layer.getLayer().addLayer(secondPolygon as any);
        const removeLayerSpy = vi.spyOn(layer.getLayer(), 'removeLayer');
        useMapStore(pinia).setLayers([layer]);

        const groupStore = useGroupStore(pinia);
        groupStore.setGroups([
            {
                id: 'g1',
                name: 'Versioned LTN',
                color: '#00aa00',
                defaultVersionId: 'v1',
                versions: [
                    {
                        id: 'v1',
                        name: 'First',
                        members: [{ layerId: 'LtnCells', historyId: 'polygon-v1' }]
                    },
                    {
                        id: 'v2',
                        name: 'Alternative',
                        members: [{ layerId: 'LtnCells', historyId: 'polygon-v2' }]
                    }
                ],
                members: [{ layerId: 'LtnCells', historyId: 'polygon-v1' }]
            }
        ]);
        recomputeFeatureVisibility();
        switchGroupVersion('g1', 'v2');

        expect((secondPolygon as any).options).toMatchObject({
            fillColor: '#00aa00'
        });
        expect(secondPolygonElement.getAttribute('stroke')).toBe('#00aa00');

        const selectionStore = useSelectionStore(pinia);
        selectionStore.activate();
        selectionStore.setSelected([]);
        selectionStore.markGroupSelection('g1');

        saveGroupSelection();

        const versions = groupStore.groups[0].versions ?? [];
        expect(versions.find((version) => version.id === 'v1')?.members).toEqual([
            { layerId: 'LtnCells', historyId: 'polygon-v1' }
        ]);
        expect(versions.find((version) => version.id === 'v2')?.members).toEqual([]);
        expect(layer.getLayer().getLayers()).toHaveLength(2);
        expect(removeLayerSpy).not.toHaveBeenCalled();
        expect((secondPolygon as any).options).toMatchObject({
            opacity: 1,
            fillOpacity: 0.5
        });

        switchGroupVersion('g1', 'v1');

        expect(layer.getLayer().getLayers()).toHaveLength(2);
        expect(removeLayerSpy).not.toHaveBeenCalled();
    });

    it('preserves shared LTN polygon membership in inactive versions', () => {
        const layer = { ...makePointLayer('LtnCells'), kind: 'polygon' as const };
        const polygon = {
            feature: {
                type: 'Feature',
                properties: { historyId: 'polygon-shared' },
                geometry: {
                    type: 'Polygon',
                    coordinates: [
                        [
                            [1, 1],
                            [2, 1],
                            [2, 2],
                            [1, 1]
                        ]
                    ]
                }
            },
            properties: { historyId: 'polygon-shared' },
            getLatLngs: () => [[{ lat: 1, lng: 1 }]],
            options: { opacity: 1, fillOpacity: 0.5, color: '#cc00cc' },
            setStyle: vi.fn(function (this: any, style: object) {
                Object.assign(this.options, style);
            })
        } as unknown as L.Layer;
        layer.getLayer().addLayer(polygon as any);
        (layer as any).loadFeature = vi.fn((_feature: unknown, historyId: string) => {
            layer.getLayer().addLayer({
                properties: { historyId },
                getLatLngs: () => [[{ lat: 1, lng: 1 }]],
                options: { opacity: 1, fillOpacity: 0.5, color: '#cc00cc' },
                setStyle(style: object) {
                    Object.assign(this.options, style);
                }
            } as any);
            return historyId;
        });
        useMapStore(pinia).setLayers([layer]);

        const member = { layerId: 'LtnCells', historyId: 'polygon-shared' };
        const groupStore = useGroupStore(pinia);
        groupStore.setGroups([
            {
                id: 'g1',
                name: 'Shared Version LTN',
                defaultVersionId: 'v1',
                versions: [
                    { id: 'v1', name: 'First', members: [member] },
                    { id: 'v2', name: 'Alternative', members: [{ ...member }] }
                ],
                members: [member]
            }
        ]);
        recomputeFeatureVisibility();

        const selectionStore = useSelectionStore(pinia);
        selectionStore.activate();
        selectionStore.setSelected([]);
        selectionStore.markGroupSelection('g1');

        saveGroupSelection();

        const versions = groupStore.groups[0].versions ?? [];
        expect(versions.find((version) => version.id === 'v1')?.members).toEqual([]);
        expect(versions.find((version) => version.id === 'v2')?.members).toEqual([
            {
                layerId: 'LtnCells',
                historyId: expect.not.stringMatching(/^polygon-shared$/)
            }
        ]);
        expect((polygon as any).options).toMatchObject({ opacity: 1, fillOpacity: 0.5 });
        expect(layer.getLayer().getLayers()).toHaveLength(2);
    });
});
