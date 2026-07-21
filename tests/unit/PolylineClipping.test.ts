import { describe, expect, it, vi } from 'vitest';

vi.mock('leaflet', () => import('./__mocks__/leaflet'));

import * as L from 'leaflet';
import { buildClippedRuns, buildComplementRuns } from '../../src/geometry/polylineClipping';

function coordinates(runs: L.LatLng[][]): number[][][] {
    return runs.map((run) => run.map((point) => [point.lng, point.lat]));
}

describe('polyline clipping', () => {
    const bounds = new L.LatLngBounds(new L.LatLng(0, 0), new L.LatLng(10, 10));

    it('extends selected and remaining runs to matching boundary points', () => {
        const west = new L.LatLng(5, -5);
        const middle = new L.LatLng(5, 5);
        const east = new L.LatLng(5, 15);
        const points = [west, middle, east];
        const selected = new Set([middle]);

        expect(coordinates(buildClippedRuns(points, selected, bounds))).toEqual([
            [
                [0, 5],
                [5, 5],
                [10, 5]
            ]
        ]);
        expect(coordinates(buildComplementRuns(points, selected, bounds))).toEqual([
            [
                [-5, 5],
                [0, 5]
            ],
            [
                [10, 5],
                [15, 5]
            ]
        ]);
    });

    it('returns separate selected runs when a path exits and re-enters', () => {
        const firstInside = new L.LatLng(5, 5);
        const firstOutside = new L.LatLng(5, 15);
        const secondOutside = new L.LatLng(5, 25);
        const secondInside = new L.LatLng(5, 5);
        const points = [firstInside, firstOutside, secondOutside, secondInside];

        expect(buildClippedRuns(points, new Set([firstInside, secondInside]), bounds)).toHaveLength(
            2
        );
    });
});
