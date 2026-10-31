/**
 * Unit tests for MapDataLoader — imported layer synchronization.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('leaflet', () => import('./__mocks__/leaflet'));

import * as L from 'leaflet';
import { MapDataLoader } from '../../src/features/map/MapDataLoader';
import { MapLayerController } from '../../src/features/map/MapLayerController';
import type { ImportedGeoJsonLayer } from '../../src/models/ImportedGeoJsonLayer';
import type { SerializedMap } from '../../src/services/MapSerializer';

describe('MapDataLoader', () => {
    it('synchronizes imported layers and clears rendered overlays for maps without them', () => {
        const settings = { centre: null, zoom: 0, activeLayers: [] };
        const map = new L.Map();
        const importedLayers: ImportedGeoJsonLayer[] = [
            {
                id: 'imported-1',
                name: 'Imported layer',
                nameProperty: null,
                visible: true,
                featureCollection: {
                    type: 'FeatureCollection',
                    features: []
                }
            }
        ];
        const setImportedLayers = vi.fn();
        const render = vi.fn();
        const loader = new MapDataLoader({
            getMap: () => map,
            setDefaultView: vi.fn(),
            mapLayerController: new MapLayerController({
                getMap: () => map,
                getLayers: () => []
            }),
            setTitle: vi.fn(),
            applySettings: vi.fn(),
            setCentre: (value) => {
                settings.centre = value;
            },
            setZoom: (value) => {
                settings.zoom = value;
            },
            getCentre: () => settings.centre,
            getZoom: () => settings.zoom,
            setVersion: vi.fn(),
            getActiveLayerIds: () => settings.activeLayers,
            setVisibleLayerIds: vi.fn(),
            setGroups: vi.fn(),
            setAllGroupsHidden: vi.fn(),
            resetGroupVisibility: vi.fn(),
            pruneDanglingGroupMembers: vi.fn(),
            appVersion: '0.11.0',
            importedLayerController: { render },
            setImportedLayers
        });

        const mapWithImportedLayer: SerializedMap = {
            layers: {},
            importedLayers
        };
        expect(loader.load(mapWithImportedLayer, null, null)).toBe(true);
        expect(setImportedLayers).toHaveBeenLastCalledWith(importedLayers);
        expect(render).toHaveBeenLastCalledWith(importedLayers);

        expect(loader.load({ layers: {} }, null, null)).toBe(true);
        expect(setImportedLayers).toHaveBeenLastCalledWith([]);
        expect(render).toHaveBeenLastCalledWith([]);
    });

    it('drops imported layers whose stored GeoJSON is invalid', () => {
        const settings = { centre: null, zoom: 0, activeLayers: [] };
        const map = new L.Map();
        const setImportedLayers = vi.fn();
        const render = vi.fn();
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const loader = new MapDataLoader({
            getMap: () => map,
            setDefaultView: vi.fn(),
            mapLayerController: new MapLayerController({
                getMap: () => map,
                getLayers: () => []
            }),
            setTitle: vi.fn(),
            applySettings: vi.fn(),
            setCentre: (value) => {
                settings.centre = value;
            },
            setZoom: (value) => {
                settings.zoom = value;
            },
            getCentre: () => settings.centre,
            getZoom: () => settings.zoom,
            setVersion: vi.fn(),
            getActiveLayerIds: () => settings.activeLayers,
            setVisibleLayerIds: vi.fn(),
            setGroups: vi.fn(),
            setAllGroupsHidden: vi.fn(),
            resetGroupVisibility: vi.fn(),
            pruneDanglingGroupMembers: vi.fn(),
            appVersion: '0.11.0',
            importedLayerController: { render },
            setImportedLayers
        });

        const corruptedMap = {
            layers: {},
            importedLayers: [
                {
                    id: 'good',
                    name: 'Good',
                    nameProperty: null,
                    featureCollection: { type: 'FeatureCollection', features: [] }
                },
                {
                    id: 'bad',
                    name: 'Bad',
                    nameProperty: null,
                    featureCollection: {
                        type: 'FeatureCollection',
                        features: [
                            {
                                type: 'Feature',
                                properties: null,
                                geometry: { type: 'LineString', coordinates: [[-1.82, 52.44]] }
                            }
                        ]
                    }
                }
            ]
        } as unknown as SerializedMap;

        expect(loader.load(corruptedMap, null, null)).toBe(true);
        expect(setImportedLayers).toHaveBeenLastCalledWith([
            expect.objectContaining({ id: 'good' })
        ]);
        expect(setImportedLayers.mock.calls.at(-1)?.[0]).toHaveLength(1);
        warn.mockRestore();
    });
});
