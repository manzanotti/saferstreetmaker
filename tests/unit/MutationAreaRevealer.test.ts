import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('leaflet', () => import('./__mocks__/leaflet'));

import * as L from 'leaflet';
import { MutationAreaRevealer } from '../../src/features/history/MutationAreaRevealer';

describe('MutationAreaRevealer', () => {
    let panTo: ReturnType<typeof vi.fn>;
    let fitBounds: ReturnType<typeof vi.fn>;
    let viewport: L.LatLngBounds;
    let revealer: MutationAreaRevealer;

    beforeEach(() => {
        panTo = vi.fn();
        fitBounds = vi.fn();
        viewport = L.latLngBounds(new L.LatLng(0, 0), new L.LatLng(10, 10));
        revealer = new MutationAreaRevealer({
            getMap: () =>
                ({
                    getBounds: () => viewport,
                    panTo,
                    fitBounds
                }) as unknown as L.Map
        });
    });

    it('does nothing when the payload has no geographic coordinates', () => {
        revealer.reveal({ beforeLabel: 'Old', afterLabel: 'New' });

        expect(panTo).not.toHaveBeenCalled();
        expect(fitBounds).not.toHaveBeenCalled();
    });

    it('centres the map when the mutation area is already visible', () => {
        revealer.reveal({ lat: 5, lng: 5 });

        expect(panTo).toHaveBeenCalledWith(expect.objectContaining({ lat: 5, lng: 5 }));
        expect(fitBounds).not.toHaveBeenCalled();
    });

    it('pans when an offscreen mutation fits within the current viewport span', () => {
        revealer.reveal({
            geometry: {
                coordinates: [20, 20]
            }
        });

        expect(panTo).toHaveBeenCalledOnce();
        expect(fitBounds).not.toHaveBeenCalled();
        expect(panTo.mock.calls[0][0]).toMatchObject({ lat: 20, lng: 20 });
    });

    it('fits bounds for a mutation area larger than the current viewport', () => {
        revealer.reveal({
            pointChanges: [{ before: [-10, -10] }, { after: [20, 20] }]
        });

        expect(panTo).not.toHaveBeenCalled();
        expect(fitBounds).toHaveBeenCalledOnce();
        expect(fitBounds.mock.calls[0][1]).toEqual({ padding: [40, 40] });
    });

    it('collects coordinates from batched nested features', () => {
        revealer.reveal({
            points: [
                {
                    geometry: {
                        coordinates: [15, 5]
                    }
                },
                {
                    geometry: {
                        coordinates: [20, 5]
                    }
                }
            ]
        });

        expect(panTo).toHaveBeenCalledOnce();
        expect(panTo.mock.calls[0][0]).toMatchObject({ lat: 5, lng: 17.5 });
    });
});
