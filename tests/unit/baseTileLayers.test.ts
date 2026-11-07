import { describe, it, expect } from 'vitest';
import {
    createBaseTileLayer,
    SATELLITE_TILE_URL,
    STREET_TILE_URL
} from '../../src/features/map/baseTileLayers';

describe('createBaseTileLayer', () => {
    it('creates the OpenStreetMap street tile layer', () => {
        const layer = createBaseTileLayer('street');
        expect((layer as unknown as { _url: string })._url).toBe(STREET_TILE_URL);
        expect(layer.options.attribution).toContain('OpenStreetMap');
        expect(layer.options.crossOrigin).toBe('anonymous');
    });

    it("creates Google's satellite tile layer", () => {
        const layer = createBaseTileLayer('satellite');
        expect((layer as unknown as { _url: string })._url).toBe(SATELLITE_TILE_URL);
        expect(SATELLITE_TILE_URL).toContain('google.com/vt/lyrs=s');
        expect(layer.options.subdomains).toEqual(['0', '1', '2', '3']);
        expect(layer.options.attribution).toContain('Google');
        expect(layer.options.crossOrigin).toBe('anonymous');
        expect(layer.options.maxZoom).toBe(20);
    });
});
