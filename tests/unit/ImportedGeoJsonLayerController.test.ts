import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as L from 'leaflet';
import { ImportedGeoJsonLayerController } from '../../src/features/map/ImportedGeoJsonLayerController';
import {
    makeLayer,
    makeLayerWithNullGeometry,
    makeMap
} from './ImportedGeoJsonLayerController.helpers';

vi.mock('leaflet', () => import('./__mocks__/leaflet'));

describe('ImportedGeoJsonLayerController', () => {
    let map: L.Map;
    let fakeLeafletLayer: {
        addTo: ReturnType<typeof vi.fn>;
        eachLayer: ReturnType<typeof vi.fn>;
        hasLayer: ReturnType<typeof vi.fn>;
        addLayer: ReturnType<typeof vi.fn>;
        removeLayer: ReturnType<typeof vi.fn>;
    };
    let options: any;
    let featureLayer: any;
    let pointOptions: any;

    beforeEach(() => {
        vi.clearAllMocks();
        map = makeMap();
        const children = new Set<unknown>();
        fakeLeafletLayer = {
            addTo: vi.fn().mockReturnThis(),
            eachLayer: vi.fn((callback: (layer: any) => void) => callback(featureLayer)),
            hasLayer: vi.fn((child: unknown) => children.has(child)),
            addLayer: vi.fn((child: unknown) => children.add(child)),
            removeLayer: vi.fn((child: unknown) => children.delete(child))
        };
        pointOptions = undefined;
        featureLayer = {
            bindPopup: vi.fn(),
            on: vi.fn(),
            setStyle: vi.fn()
        };
        options = undefined;
        vi.spyOn(L, 'circleMarker').mockImplementation((_latLng: any, markerOptions: any) => {
            pointOptions = markerOptions;
            return {} as any;
        });
        vi.spyOn(L, 'geoJSON').mockImplementation((data: any, layerOptions: any) => {
            options = layerOptions;
            layerOptions.pointToLayer?.({}, { lat: 52.5, lng: -1.9 });
            const renderedFeature = data.features.find((feature: any) => feature.geometry !== null);
            layerOptions.onEachFeature(renderedFeature, featureLayer);
            children.add(featureLayer);
            return fakeLeafletLayer as any;
        });
    });

    it('renders visible layers, skips hidden layers, and clears rendered layers', () => {
        const controller = new ImportedGeoJsonLayerController({
            getMap: () => map,
            onFeaturePropertyChange: vi.fn(),
            isReadOnly: () => false,
            getActiveLayerId: () => null
        });

        controller.render([makeLayer('visible-layer'), makeLayer('hidden-layer', false)]);
        expect(fakeLeafletLayer.addTo).toHaveBeenCalledOnce();
        expect(pointOptions.pane).toBe('imported');

        expect(map.removeLayer).not.toHaveBeenCalled();
        controller.clear();
        expect(map.removeLayer).toHaveBeenCalledOnce();
    });

    it('suppresses imports temporarily without mutating flags or rebuilding cached geometry', () => {
        let suppressed = false;
        const layer = makeLayer();
        const hidden = makeLayer('hidden', false);
        const controller = new ImportedGeoJsonLayerController({
            getMap: () => map,
            onFeaturePropertyChange: vi.fn(),
            isReadOnly: () => false,
            getActiveLayerId: () => null,
            isSuppressed: () => suppressed
        });
        controller.render([layer, hidden]);
        suppressed = true;
        controller.render([layer, hidden, makeLayer('new')]);
        expect(map.removeLayer).toHaveBeenCalledOnce();
        expect(L.geoJSON).toHaveBeenCalledOnce();
        expect(layer.visible).toBe(true);
        expect(hidden.visible).toBe(false);
        suppressed = false;
        controller.render([layer, hidden, makeLayer('new')]);
        expect(L.geoJSON).toHaveBeenCalledTimes(2);
        expect(fakeLeafletLayer.addTo).toHaveBeenCalledTimes(3);
    });

    it('keeps rendered geometry when only layer metadata changes', () => {
        const layer = makeLayer();
        const controller = new ImportedGeoJsonLayerController({
            getMap: () => map,
            onFeaturePropertyChange: vi.fn(),
            isReadOnly: () => false,
            getActiveLayerId: () => null
        });

        controller.render([layer]);
        layer.name = 'Renamed wards';
        layer.featureCollection.features[0].properties!.name = 'Renamed feature';
        controller.render([layer]);

        expect(L.geoJSON).toHaveBeenCalledOnce();
        expect(map.removeLayer).not.toHaveBeenCalled();
    });

    it('reattaches unchanged geometry after hiding and showing an imported layer', () => {
        const layer = makeLayer();
        const controller = new ImportedGeoJsonLayerController({
            getMap: () => map,
            onFeaturePropertyChange: vi.fn(),
            isReadOnly: () => false,
            getActiveLayerId: () => null
        });

        controller.render([layer]);
        const zoomHandler = vi.mocked(map.on).mock.calls[0][1] as () => void;
        layer.visible = false;
        controller.render([layer]);
        featureLayer.setStyle.mockClear();
        zoomHandler();
        expect(featureLayer.setStyle).not.toHaveBeenCalled();
        layer.visible = true;
        controller.render([layer]);

        expect(map.removeLayer).toHaveBeenCalledOnce();
        expect(fakeLeafletLayer.addTo).toHaveBeenCalledTimes(2);
        expect(L.geoJSON).toHaveBeenCalledOnce();
        expect(featureLayer.setStyle).toHaveBeenCalledOnce();
    });

    it('rebuilds changed geometry while hidden and releases deleted geometry', () => {
        const layer = makeLayer();
        const controller = new ImportedGeoJsonLayerController({
            getMap: () => map,
            onFeaturePropertyChange: vi.fn(),
            isReadOnly: () => false,
            getActiveLayerId: () => null
        });

        controller.render([layer]);
        layer.visible = false;
        controller.render([layer]);
        layer.featureCollection = makeLayer().featureCollection;
        controller.render([layer]);
        layer.visible = true;
        controller.render([layer]);
        expect(L.geoJSON).toHaveBeenCalledTimes(2);

        controller.render([]);
        controller.render([layer]);
        expect(L.geoJSON).toHaveBeenCalledTimes(3);
    });

    it('hides imported point features eight zoom levels from maximum', () => {
        const controller = new ImportedGeoJsonLayerController({
            getMap: () => map,
            onFeaturePropertyChange: vi.fn(),
            isReadOnly: () => false,
            getActiveLayerId: () => null
        });

        controller.render([makeLayer()]);
        expect(featureLayer.setStyle).toHaveBeenCalledWith({ opacity: 0, fillOpacity: 0 });

        vi.mocked(map.getZoom).mockReturnValue(13);
        const zoomHandler = vi.mocked(map.on).mock.calls[0][1] as () => void;
        zoomHandler();
        expect(featureLayer.setStyle).toHaveBeenLastCalledWith({
            opacity: 0.8,
            fillOpacity: 0.8
        });
    });

    it('detaches hidden features and restores cached children without rebuilding geometry', () => {
        let visible = true;
        const layer = makeLayerWithNullGeometry();
        const isFeatureVisible = vi.fn((_id: string, index: number) => index === 1 && visible);
        const controller = new ImportedGeoJsonLayerController({
            getMap: () => map,
            onFeaturePropertyChange: vi.fn(),
            isReadOnly: () => false,
            getActiveLayerId: () => null,
            isFeatureVisible
        });
        controller.render([layer]);
        visible = false;
        controller.render([layer]);
        expect(fakeLeafletLayer.removeLayer).toHaveBeenCalledWith(featureLayer);
        expect(fakeLeafletLayer.hasLayer(featureLayer)).toBe(false);
        expect(isFeatureVisible).toHaveBeenCalledWith(layer.id, 1);

        layer.visible = false;
        visible = true;
        controller.render([layer]);
        expect(fakeLeafletLayer.addLayer).toHaveBeenCalledWith(featureLayer);
        layer.visible = true;
        controller.render([layer]);
        expect(L.geoJSON).toHaveBeenCalledOnce();
        expect(fakeLeafletLayer.hasLayer(featureLayer)).toBe(true);

        controller.clear();
        fakeLeafletLayer.removeLayer.mockClear();
        controller.render([makeLayer('other')]);
        expect(fakeLeafletLayer.removeLayer).toHaveBeenCalledOnce();
    });
});
