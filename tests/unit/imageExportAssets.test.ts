import { describe, expect, it, vi } from 'vitest';
import {
    createPngBlob,
    removeMapControlsFromClone,
    waitForMapAssets
} from '../../src/features/export/imageExportAssets';

describe('image export assets', () => {
    it('preserves attribution and the legend while removing other controls and editors', () => {
        const clone = document.implementation.createHTMLDocument();
        clone.body.innerHTML = `
            <div id="map">
                <div class="leaflet-control leaflet-control-attribution">attribution</div>
                <div class="leaflet-control"><div data-image-export-legend>legend</div></div>
                <div class="leaflet-control">toolbar</div>
                <div class="leaflet-popup-pane"></div>
                <div class="leaflet-editing-icon"></div>
            </div>`;

        removeMapControlsFromClone(clone);

        expect(clone.querySelectorAll('.leaflet-control')).toHaveLength(2);
        expect(clone.querySelector('.leaflet-control-attribution')?.textContent).toBe(
            'attribution'
        );
        expect(clone.querySelector('[data-image-export-legend]')?.textContent).toBe('legend');
        expect(clone.querySelector('.leaflet-popup-pane')).toBeNull();
        expect(clone.querySelector('.leaflet-editing-icon')).toBeNull();
    });

    it('reports an unloaded visible image rather than exporting an incomplete map', async () => {
        const map = document.createElement('div');
        const image = document.createElement('img');
        map.append(image);
        const rect = new DOMRect(0, 0, 100, 100);
        vi.spyOn(map, 'getBoundingClientRect').mockReturnValue(rect);
        vi.spyOn(image, 'getBoundingClientRect').mockReturnValue(rect);
        Object.defineProperty(image, 'complete', { value: true });
        Object.defineProperty(image, 'naturalWidth', { value: 0 });

        await expect(waitForMapAssets(map)).rejects.toThrow('A map image did not load');
    });

    it('reports both PNG conversion failures and canvas security errors', async () => {
        const canvas = document.createElement('canvas');
        const toBlob = vi.spyOn(canvas, 'toBlob');
        toBlob.mockImplementation((callback) => callback(null));
        await expect(createPngBlob(canvas)).rejects.toThrow('image could not be created');

        toBlob.mockImplementation(() => {
            throw new DOMException('Tainted canvas', 'SecurityError');
        });
        await expect(createPngBlob(canvas)).rejects.toThrow('image permissions');
    });
});
