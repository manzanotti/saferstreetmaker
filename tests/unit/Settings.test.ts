import { describe, it, expect, vi } from 'vitest';
import { Settings } from '../../src/Settings';

// LatLng is used in Settings defaults – mock leaflet
vi.mock('leaflet', () => ({
    LatLng: class {
        lat: number;
        lng: number;
        constructor(lat: number, lng: number) {
            this.lat = lat;
            this.lng = lng;
        }
    },
}));

describe('Settings', () => {
    it('has correct default title', () => {
        const s = new Settings();
        expect(s.title).toBe('Hello, Cleveland');
    });

    it('defaults readOnly to false', () => {
        const s = new Settings();
        expect(s.readOnly).toBe(false);
    });

    it('defaults hideToolbar to false', () => {
        const s = new Settings();
        expect(s.hideToolbar).toBe(false);
    });

    it('defaults activeLayers to an empty array', () => {
        const s = new Settings();
        expect(s.activeLayers).toEqual([]);
    });

    it('defaults centre to (0, 0)', () => {
        const s = new Settings();
        expect(s.centre.lat).toBe(0);
        expect(s.centre.lng).toBe(0);
    });

    it('defaults zoom to 0', () => {
        const s = new Settings();
        expect(s.zoom).toBe(0);
    });

    it('defaults version to empty string', () => {
        const s = new Settings();
        expect(s.version).toBe('');
    });

    it('properties are mutable', () => {
        const s = new Settings();
        s.title = 'My Map';
        s.readOnly = true;
        s.zoom = 12;
        expect(s.title).toBe('My Map');
        expect(s.readOnly).toBe(true);
        expect(s.zoom).toBe(12);
    });
});
