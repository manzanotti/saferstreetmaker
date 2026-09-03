import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setActivePinia } from 'pinia';
import { nextTick } from 'vue';

vi.mock('leaflet', () => import('../__mocks__/leaflet'));

import * as L from 'leaflet';
import { setupMapManager } from '../../../src/composables/useMapManager';
import type { ImportedGeoJsonLayer } from '../../../src/models/ImportedGeoJsonLayer';
import { FileManager } from '../../../src/services/FileManager';
import { pinia } from '../../../src/stores';
import { useImportedLayerStore } from '../../../src/stores/importedLayerStore';
import { useMapStore } from '../../../src/stores/mapStore';
import { useSettingsStore } from '../../../src/stores/settingsStore';

const defaultLayer: ImportedGeoJsonLayer = {
    id: 'default-layer',
    name: 'Default layer',
    nameProperty: null,
    visible: false,
    featureCollection: {
        type: 'FeatureCollection',
        features: []
    }
};

describe('default imported layer seeding', () => {
    beforeEach(() => {
        setActivePinia(pinia);
        useImportedLayerStore(pinia).clear();
        useMapStore(pinia).setMap(new L.Map() as unknown as L.Map);
    });

    it('does not seed a default after a user edit has started saving', async () => {
        let finishUserSave: (() => void) | undefined;
        const fileManager = new FileManager();
        const saveMap = vi.spyOn(fileManager, 'saveMap');
        saveMap
            .mockImplementationOnce(
                () =>
                    new Promise<void>((resolve) => {
                        finishUserSave = resolve;
                    })
            )
            .mockResolvedValue(undefined);
        const manager = setupMapManager(fileManager);
        const mapStore = useMapStore(pinia);
        const settingsStore = useSettingsStore(pinia);
        const importedLayerStore = useImportedLayerStore(pinia);

        settingsStore.title = 'Edited before default loaded';
        mapStore.markLayerUpdated();
        await nextTick();

        const seeding = manager.initialiseDefaultImportedLayers([defaultLayer], {
            allowInitialSeed: true
        });
        await seeding;

        expect(saveMap).toHaveBeenCalledOnce();
        expect(importedLayerStore.layers).toEqual([]);

        finishUserSave?.();
        await Promise.resolve();
    });

    it('preserves the pending default seed after a duplicate map attempt', async () => {
        const fileManager = new FileManager();
        vi.spyOn(fileManager, 'loadMapListFromStorage').mockResolvedValue(['Existing map']);
        const manager = setupMapManager(fileManager);
        const initialGeneration = manager.getMapGeneration();

        expect(await manager.createNewMap('Existing map')).toBe(false);
        expect(manager.getMapGeneration()).toBe(initialGeneration);

        await manager.initialiseDefaultImportedLayers([defaultLayer], {
            expectedGeneration: initialGeneration,
            allowInitialSeed: true
        });

        expect(useImportedLayerStore(pinia).layers).toEqual([defaultLayer]);
    });
});
