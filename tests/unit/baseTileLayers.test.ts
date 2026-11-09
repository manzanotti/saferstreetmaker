import { describe, it, expect } from 'vitest';
import {
    createBaseTileLayer,
    SATELLITE_TILE_URL,
    STREET_TILE_URL
} from '../../src/features/map/baseTileLayers';

describe('createBaseTileLayer', () => {
    it('creates the OpenStreetMap street tile layer', () => {
        const layer = createBaseTileLayer('street');
        expect(STREET_TILE_URL).toBe('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
        expect(layer).toHaveProperty('_url', STREET_TILE_URL);
        expect(layer.options.attribution).toContain(
            '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors'
        );
        expect(layer.options.crossOrigin).toBe('anonymous');
        expect(layer.options.maxNativeZoom).toBe(19);
        expect(layer.options.maxZoom).toBe(20);
    });

    it("creates Google's satellite tile layer", () => {
        const layer = createBaseTileLayer('satellite');
        expect(layer).toHaveProperty('_url', SATELLITE_TILE_URL);
        expect(SATELLITE_TILE_URL).toContain('google.com/vt/lyrs=s');
        expect(layer.options.subdomains).toEqual(['0', '1', '2', '3']);
        expect(layer.options.attribution).toContain('Google');
        expect(layer.options.crossOrigin).toBe('anonymous');
        expect(layer.options.maxZoom).toBe(20);
    });
});
