import { describe, expect, it, vi } from 'vitest';
import { setActivePinia } from 'pinia';
import { effectScope } from 'vue';

vi.mock('leaflet', () => import('../__mocks__/leaflet'));

import * as L from 'leaflet';
import { setupMapManager } from '../../../src/composables/useMapManager';
import type { ImportedGeoJsonLayer } from '../../../src/models/ImportedGeoJsonLayer';
import { FileManager } from '../../../src/services/FileManager';
import { pinia } from '../../../src/stores';
import { useImportedLayerStore } from '../../../src/stores/importedLayerStore';
import { useMapStore } from '../../../src/stores/mapStore';

const defaultLayer: ImportedGeoJsonLayer = {
    id: 'default-layer',
    name: 'Default layer',
    nameProperty: null,
    visible: false,
    featureCollection: { type: 'FeatureCollection', features: [] }
};

describe('map manager composition', () => {
    it('waits for the initial-layer persistence barrier before a user save', async () => {
        setActivePinia(pinia);
        useImportedLayerStore(pinia).clear();
        useMapStore(pinia).setMap(new L.Map());
        const fileManager = new FileManager();
        let releaseSeedSave: () => void = () => {
            throw new Error('Seed save has not started');
        };
        const saveMap = vi
            .spyOn(fileManager, 'saveMap')
            .mockImplementationOnce(
                () =>
                    new Promise<void>((resolve) => {
                        releaseSeedSave = resolve;
                    })
            )
            .mockResolvedValue(undefined);
        const scope = effectScope();
        try {
            const manager = scope.run(() => setupMapManager(fileManager));
            if (!manager) {
                throw new Error('Map manager scope did not start');
            }
            const seed = manager.initialiseDefaultImportedLayers([defaultLayer], {
                allowInitialSeed: true
            });
            await vi.waitFor(() => expect(saveMap).toHaveBeenCalledTimes(1));
            const userSave = manager.saveMap();
            await Promise.resolve();
            expect(saveMap).toHaveBeenCalledTimes(1);

            releaseSeedSave();
            await Promise.all([seed, userSave]);
            expect(saveMap).toHaveBeenCalledTimes(2);
            expect(useImportedLayerStore(pinia).layers).toEqual([defaultLayer]);
        } finally {
            scope.stop();
            vi.restoreAllMocks();
        }
    });

    it('restores the generation when creating a map fails', async () => {
        setActivePinia(pinia);
        useMapStore(pinia).setMap(new L.Map());
        const fileManager = new FileManager();
        vi.spyOn(fileManager, 'loadMapListFromStorage').mockRejectedValue(
            new Error('storage failed')
        );
        const scope = effectScope();
        try {
            const manager = scope.run(() => setupMapManager(fileManager));
            if (!manager) {
                throw new Error('Map manager scope did not start');
            }
            const generation = manager.getMapGeneration();
            await expect(manager.createNewMap('New map')).rejects.toThrow('storage failed');
            expect(manager.getMapGeneration()).toBe(generation);
        } finally {
            scope.stop();
            vi.restoreAllMocks();
        }
    });
});
