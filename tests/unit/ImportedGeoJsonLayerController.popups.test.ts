/**
 * Unit tests for ImportedGeoJsonLayerController — popups, feature clicks and point styling.
 */
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

    it('stops styling point features after their imported layer is deleted', () => {
        const controller = new ImportedGeoJsonLayerController({
            getMap: () => map,
            onFeaturePropertyChange: vi.fn(),
            isReadOnly: () => false,
            getActiveLayerId: () => null
        });

        controller.render([makeLayer()]);
        const zoomHandler = vi.mocked(map.on).mock.calls[0][1] as () => void;
        featureLayer.setStyle.mockClear();

        controller.render([]);
        zoomHandler();

        expect(featureLayer.setStyle).not.toHaveBeenCalled();
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

    it('uses the source feature index after a null-geometry feature', () => {
        const onFeaturePropertyChange = vi.fn();
        const controller = new ImportedGeoJsonLayerController({
            getMap: () => map,
            onFeaturePropertyChange,
            isReadOnly: () => false,
            getActiveLayerId: () => null
        });

        controller.render([makeLayerWithNullGeometry()]);
        const popup = featureLayer.bindPopup.mock.calls[0][0]();
        const input = popup.querySelector('input') as HTMLInputElement;
        input.value = 'Renamed';
        input.dispatchEvent(new Event('blur'));

        expect(onFeaturePropertyChange).toHaveBeenCalledWith('layer-1', 1, 'name', 'Renamed');
    });

    it('uses current metadata in popups after reattaching an imported layer', () => {
        const layer = makeLayer();
        const onFeaturePropertyChange = vi.fn();
        const controller = new ImportedGeoJsonLayerController({
            getMap: () => map,
            onFeaturePropertyChange,
            isReadOnly: () => false,
            getActiveLayerId: () => null
        });

        controller.render([layer]);
        controller.render([{ ...layer, name: 'Renamed wards', visible: false }]);
        controller.render([{ ...layer, name: 'Renamed wards', nameProperty: null }]);
        const popup = featureLayer.bindPopup.mock.calls[0][0]();
        expect(popup.querySelector('span')?.textContent).toBe('Renamed wards');

        controller.render([{ ...layer, nameProperty: 'newName' }]);
        const updatedPopup = featureLayer.bindPopup.mock.calls[0][0]();
        const input = updatedPopup.querySelector('input') as HTMLInputElement;
        input.value = 'Updated';
        input.dispatchEvent(new Event('blur'));
        expect(onFeaturePropertyChange).toHaveBeenCalledWith('layer-1', 0, 'newName', 'Updated');
        expect(L.geoJSON).toHaveBeenCalledOnce();
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
