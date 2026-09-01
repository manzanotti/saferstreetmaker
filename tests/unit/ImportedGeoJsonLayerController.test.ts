import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as L from 'leaflet';
import { ImportedGeoJsonLayerController } from '../../src/features/map/ImportedGeoJsonLayerController';
import type { ImportedGeoJsonLayer } from '../../src/models/ImportedGeoJsonLayer';

vi.mock('leaflet', () => import('./__mocks__/leaflet'));

function makeLayer(visible = true): ImportedGeoJsonLayer {
    return {
        id: 'layer-1',
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
        closePopup: vi.fn()
    } as unknown as L.Map;
}

describe('ImportedGeoJsonLayerController', () => {
    let map: L.Map;
    let fakeLeafletLayer: { addTo: ReturnType<typeof vi.fn> };
    let options: any;
    let featureLayer: any;

    beforeEach(() => {
        map = makeMap();
        fakeLeafletLayer = { addTo: vi.fn().mockReturnThis() };
        featureLayer = {
            bindPopup: vi.fn(),
            on: vi.fn()
        };
        options = undefined;
        vi.spyOn(L, 'geoJSON').mockImplementation((_data: any, layerOptions: any) => {
            options = layerOptions;
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

        controller.render([makeLayer(), makeLayer(false)]);
        expect(fakeLeafletLayer.addTo).toHaveBeenCalledOnce();

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

        readOnly = true;
        controller.render([makeLayer()]);
        const readOnlyPopup = featureLayer.bindPopup.mock.calls[1][0]();
        expect(readOnlyPopup.querySelector('span')?.textContent).toBe('Ward 1');
        expect(readOnlyPopup.querySelector('input')).toBeNull();
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
});
