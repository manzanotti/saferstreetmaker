import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('leaflet', () => import('../__mocks__/leaflet'));

import { useSettingsStore } from '../../../src/stores/settingsStore';
import { Settings } from '../../../src/models/Settings';
import * as L from 'leaflet';

describe('settingsStore', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
    });

    it('initialises with defaults', () => {
        const store = useSettingsStore();
        expect(store.title).toBe('Hello Cleveland');
        expect(store.readOnly).toBe(false);
        expect(store.hideToolbar).toBe(false);
        expect(store.activeLayers).toEqual([]);
        expect(store.centre).toBeNull();
        expect(store.zoom).toBe(0);
        expect(store.version).toBe('');
    });

    describe('applyFromSettings()', () => {
        it('copies all fields from the argument', () => {
            const store = useSettingsStore();
            const centre = new L.LatLng(52.5, -1.9);
            store.applyFromSettings({
                title: 'My City',
                readOnly: true,
                hideToolbar: false,
                activeLayers: ['MobilityLanes', 'LtnCells'],
                centre,
                zoom: 14,
                version: '0.8.1'
            });
            expect(store.title).toBe('My City');
            expect(store.readOnly).toBe(true);
            expect(store.hideToolbar).toBe(false);
            expect(store.activeLayers).toEqual(['MobilityLanes', 'LtnCells']);
            expect(store.centre).toEqual(centre);
            expect(store.zoom).toBe(14);
            expect(store.version).toBe('0.8.1');
        });

        it('accepts null centre', () => {
            const store = useSettingsStore();
            store.applyFromSettings({
                title: 'Test',
                readOnly: false,
                hideToolbar: false,
                activeLayers: [],
                centre: null,
                zoom: 10,
                version: ''
            });
            expect(store.centre).toBeNull();
        });
    });

    describe('toSettings()', () => {
        it('returns a Settings instance with current store values', () => {
            const store = useSettingsStore();
            const centre = new L.LatLng(51.5, -0.1);
            store.title = 'London';
            store.readOnly = true;
            store.hideToolbar = true;
            store.activeLayers = ['ModalFilters'];
            store.centre = centre;
            store.zoom = 15;
            store.version = '1.0';

            const s = store.toSettings();
            expect(s).toBeInstanceOf(Settings);
            expect(s.title).toBe('London');
            expect(s.readOnly).toBe(true);
            expect(s.hideToolbar).toBe(true);
            expect(s.activeLayers).toEqual(['ModalFilters']);
            expect(s.centre).toEqual(centre);
            expect(s.zoom).toBe(15);
            expect(s.version).toBe('1.0');
        });

        it('returns a copy of activeLayers, not the original array', () => {
            const store = useSettingsStore();
            store.activeLayers = ['a', 'b'];
            const s = store.toSettings();
            s.activeLayers.push('c');
            expect(store.activeLayers).toHaveLength(2);
        });

        it('falls back to LatLng(0,0) when centre is null', () => {
            const store = useSettingsStore();
            store.centre = null;
            const s = store.toSettings();
            expect(s.centre.lat).toBe(0);
            expect(s.centre.lng).toBe(0);
        });
    });
});
