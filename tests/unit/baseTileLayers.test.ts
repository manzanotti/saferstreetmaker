import { describe, it, expect } from 'vitest';
import {
    createBaseTileLayer,
    createSatelliteLabelsLayer,
    SATELLITE_TILE_URL,
    SATELLITE_LABELS_TILE_URL,
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

    it("creates Esri's satellite imagery tile layer", () => {
        const layer = createBaseTileLayer('satellite');
        expect(SATELLITE_TILE_URL).toBe(
            'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        );
        expect(layer).toHaveProperty('_url', SATELLITE_TILE_URL);
        expect(layer.options.attribution).toContain(
            'Source: Esri, Vantor, Earthstar Geographics, and the GIS User Community'
        );
        expect(layer.options.attribution).toContain('saferstreetmaker.org');
        expect(layer.options.crossOrigin).toBe('anonymous');
        expect(layer.options.maxZoom).toBe(20);
    });

    it('creates a transparent transportation labels overlay for satellite view', () => {
        const layer = createSatelliteLabelsLayer();
        expect(SATELLITE_LABELS_TILE_URL).toBe(
            'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}'
        );
        expect(layer).toHaveProperty('_url', SATELLITE_LABELS_TILE_URL);
        expect(layer.options.attribution).toContain(
            '&copy; Esri, HERE, Garmin, (c) OpenStreetMap contributors'
        );
        expect(layer.options.attribution).toContain('World_Transportation/MapServer');
        expect(layer.options.crossOrigin).toBe('anonymous');
        expect(layer.options.maxZoom).toBe(20);
    });
});
