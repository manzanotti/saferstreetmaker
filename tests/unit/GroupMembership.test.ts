import { describe, expect, it } from 'vitest';
import type * as L from 'leaflet';
import type { IMapLayer } from '../../src/composables/layers/IMapLayer';
import { analyzeSelectionMembership } from '../../src/features/groups/groupMembership';
import type { SelectedMarker } from '../../src/stores/selectionStore';

function layer(id: string, kind: IMapLayer['kind']): IMapLayer {
    return { id, title: `${id} title`, kind } as IMapLayer;
}

function selected(
    layerId: string,
    historyId: string | null,
    marker: L.Layer,
    latLng: L.LatLng
): SelectedMarker {
    return { layerId, historyId, marker, latLng };
}

describe('analyzeSelectionMembership', () => {
    it('returns null for an empty selection', () => {
        expect(analyzeSelectionMembership([], [], null)).toBeNull();
    });

    it('classifies points as full members and skips missing history IDs', () => {
        const marker = {} as L.Layer;
        const latLng = { lat: 1, lng: 2 } as L.LatLng;

        const result = analyzeSelectionMembership(
            [
                selected('Points', 'point-1', marker, latLng),
                selected('Points', null, {} as L.Layer, latLng)
            ],
            [layer('Points', 'point')],
            null
        );

        expect(result).toEqual({
            fullMembers: [{ layerId: 'Points', historyId: 'point-1' }],
            partialSplits: []
        });
    });

    it('deduplicates polygon render instances with the same feature identity', () => {
        const latLng = { lat: 1, lng: 2 } as L.LatLng;
        const result = analyzeSelectionMembership(
            [
                selected('LtnCells', 'polygon-1', {} as L.Layer, latLng),
                selected('LtnCells', 'polygon-1', {} as L.Layer, latLng)
            ],
            [layer('LtnCells', 'polygon')],
            null
        );

        expect(result?.fullMembers).toEqual([{ layerId: 'LtnCells', historyId: 'polygon-1' }]);
    });

    it('classifies a fully selected polyline as one full member', () => {
        const first = { lat: 1, lng: 1 } as L.LatLng;
        const second = { lat: 2, lng: 2 } as L.LatLng;
        const marker = { getLatLngs: () => [first, second] } as unknown as L.Layer;

        const result = analyzeSelectionMembership(
            [
                selected('Lines', 'line-1', marker, first),
                selected('Lines', 'line-1', marker, second)
            ],
            [layer('Lines', 'polyline')],
            null
        );

        expect(result?.fullMembers).toEqual([{ layerId: 'Lines', historyId: 'line-1' }]);
        expect(result?.partialSplits).toHaveLength(0);
    });

    it('describes a partially selected polyline with its clipping bounds', () => {
        const first = { lat: 1, lng: 1 } as L.LatLng;
        const second = { lat: 2, lng: 2 } as L.LatLng;
        const marker = { getLatLngs: () => [first, second] } as unknown as L.Layer;
        const bounds = {} as L.LatLngBounds;

        const result = analyzeSelectionMembership(
            [selected('Lines', 'line-1', marker, first)],
            [layer('Lines', 'polyline')],
            bounds
        );

        expect(result?.fullMembers).toHaveLength(0);
        expect(result?.partialSplits).toEqual([
            {
                layerId: 'Lines',
                layerTitle: 'Lines title',
                marker,
                selectedLatLngs: [first],
                allLatLngs: [first, second],
                clipBounds: bounds
            }
        ]);
    });
});
