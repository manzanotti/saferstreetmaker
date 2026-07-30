import { describe, expect, it, vi } from 'vitest';
import type * as L from 'leaflet';
import type { IMapLayer } from '../../src/composables/layers/IMapLayer';
import { GroupPolylineSplitter } from '../../src/features/groups/GroupPolylineSplitter';
import type { PartialPolylineSplit } from '../../src/models/Group';

function createLayer() {
    const removeLayer = vi.fn();
    const loadFromGeoJSON = vi.fn();
    const layer = {
        id: 'Lines',
        getLayer: () => ({ removeLayer }),
        loadFromGeoJSON
    } as unknown as IMapLayer;
    return { layer, removeLayer, loadFromGeoJSON };
}

describe('GroupPolylineSplitter', () => {
    it('replaces an original line and returns only the grouped replacement', () => {
        const { layer, removeLayer, loadFromGeoJSON } = createLayer();
        const first = { lat: 1, lng: 1 } as L.LatLng;
        const second = { lat: 2, lng: 2 } as L.LatLng;
        const third = { lat: 3, lng: 3 } as L.LatLng;
        const fourth = { lat: 4, lng: 4 } as L.LatLng;
        const marker = {
            feature: { properties: { historyId: 'source-id', name: 'Canal route' } }
        } as unknown as L.Layer;
        const ids = ['inside-id', 'outside-id'];
        const splitter = new GroupPolylineSplitter({
            getLayer: () => layer,
            createHistoryId: () => ids.shift() ?? 'unexpected-id'
        });

        const members = splitter.split([
            {
                layerId: 'Lines',
                layerTitle: 'Lines',
                marker,
                selectedLatLngs: [first, second],
                allLatLngs: [first, second, third, fourth]
            }
        ]);

        expect(removeLayer).toHaveBeenCalledWith(marker);
        expect(loadFromGeoJSON).toHaveBeenCalledTimes(2);
        expect(loadFromGeoJSON.mock.calls[0][0].features[0]).toMatchObject({
            geometry: {
                coordinates: [
                    [1, 1],
                    [2, 2]
                ]
            },
            properties: { historyId: 'inside-id', name: 'Canal route' }
        });
        expect(loadFromGeoJSON.mock.calls[1][0].features[0]).toMatchObject({
            geometry: {
                coordinates: [
                    [3, 3],
                    [4, 4]
                ]
            },
            properties: { historyId: 'outside-id', name: 'Canal route' }
        });
        expect(members).toEqual([{ layerId: 'Lines', historyId: 'inside-id' }]);
    });

    it('ignores a split whose layer no longer exists', () => {
        const split = {
            layerId: 'Missing',
            layerTitle: 'Missing',
            marker: {} as L.Layer,
            selectedLatLngs: [],
            allLatLngs: []
        } satisfies PartialPolylineSplit;
        const createHistoryId = vi.fn();
        const splitter = new GroupPolylineSplitter({
            getLayer: () => undefined,
            createHistoryId
        });

        expect(splitter.split([split])).toEqual([]);
        expect(createHistoryId).not.toHaveBeenCalled();
    });
});
