import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as L from 'leaflet';
import { ImportedGeoJsonLayerController } from '../../src/features/map/ImportedGeoJsonLayerController';
import type { ImportedGeoJsonLayer } from '../../src/models/ImportedGeoJsonLayer';

vi.mock('leaflet', () => import('./__mocks__/leaflet'));

function makeLayer(id = 'layer-1', visible = true): ImportedGeoJsonLayer {
    return {
        id,
        name: 'Wards',
        nameProperty: 'name',
        visible,
        featureCollection: {
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    properties: { name: 'Ward 1' },
                    geometry: { type: 'Point', coordinates: [-1.9, 52.5] }
                }
            ]
        }
    };
}

function makeMap() {
    return {
        addLayer: vi.fn(),
        removeLayer: vi.fn(),
        fire: vi.fn(),
        closePopup: vi.fn(),
        getZoom: vi.fn().mockReturnValue(10),
        getMaxZoom: vi.fn().mockReturnValue(20),
        on: vi.fn()
    } as unknown as L.Map;
}

describe('ImportedGeoJsonLayerController', () => {
    let map: L.Map;
    let fakeLeafletLayer: { addTo: ReturnType<typeof vi.fn> };
    let options: any;
    let featureLayer: any;
    let pointOptions: any;

    beforeEach(() => {
        vi.clearAllMocks();
        map = makeMap();
        fakeLeafletLayer = {
            addTo: vi.fn().mockReturnThis(),
            eachLayer: vi.fn((callback: (layer: any) => void) => callback(featureLayer))
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
        vi.spyOn(L, 'geoJSON').mockImplementation((_data: any, layerOptions: any) => {
            options = layerOptions;
            layerOptions.pointToLayer?.({}, { lat: 52.5, lng: -1.9 });
            layerOptions.onEachFeature(makeLayer().featureCollection.features[0], featureLayer);
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

    it('builds editable and read-only popup content and reports edits', () => {
        const onFeaturePropertyChange = vi.fn();
        let readOnly = false;
        const controller = new ImportedGeoJsonLayerController({
            getMap: () => map,
            onFeaturePropertyChange,
            isReadOnly: () => readOnly,
            getActiveLayerId: () => null
        });

        controller.render([makeLayer()]);
        const editablePopup = featureLayer.bindPopup.mock.calls[0][0]();
        const input = editablePopup.querySelector('input') as HTMLInputElement;
        input.value = 'Renamed';
        input.dispatchEvent(new Event('blur'));
        expect(onFeaturePropertyChange).toHaveBeenCalledWith('layer-1', 0, 'name', 'Renamed');

        onFeaturePropertyChange.mockClear();
        const unchangedPopup = featureLayer.bindPopup.mock.calls[0][0]();
        unchangedPopup.querySelector('input')?.dispatchEvent(new Event('blur'));
        expect(onFeaturePropertyChange).not.toHaveBeenCalled();

        readOnly = true;
        controller.render([makeLayer()]);
        const readOnlyPopup = featureLayer.bindPopup.mock.calls[0][0]();
        expect(readOnlyPopup.querySelector('span')?.textContent).toBe('Ward 1');
        expect(readOnlyPopup.querySelector('input')).toBeNull();
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

    it('forwards feature clicks to the active map tool and closes the popup', () => {
        let activeLayerId: string | null = 'modal-filter';
        const controller = new ImportedGeoJsonLayerController({
            getMap: () => map,
            onFeaturePropertyChange: vi.fn(),
            isReadOnly: () => false,
            getActiveLayerId: () => activeLayerId
        });

        controller.render([makeLayer()]);
        const clickHandler = featureLayer.on.mock.calls[0][1];
        clickHandler({ latlng: { lat: 52.5, lng: -1.9 } });
        expect(map.fire).toHaveBeenCalledWith('click', { latlng: { lat: 52.5, lng: -1.9 } });
        expect(map.closePopup).toHaveBeenCalledOnce();

        activeLayerId = null;
        clickHandler({ latlng: { lat: 52.5, lng: -1.9 } });
        expect(map.fire).toHaveBeenCalledOnce();
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
});
