import { expect, test, type Locator, type Page } from '@playwright/test';
import { Buffer } from 'node:buffer';
import { clickMap, waitForMapReady } from './layers/layerMapTestHelpers';
import { setMapZoom } from './layers/layerPointTestHelpers';

export async function createTilePng(page: import('@playwright/test').Page): Promise<Buffer> {
    const base64 = await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const context = canvas.getContext('2d');
        if (!context) {
            throw new Error('Canvas unavailable');
        }
        for (let y = 0; y < 32; y += 4) {
            for (let x = 0; x < 32; x += 4) {
                context.fillStyle = `hsl(${(x * 17 + y * 31) % 360} 65% 60%)`;
                context.fillRect(x, y, 4, 4);
            }
        }
        return canvas.toDataURL('image/png').split(',')[1];
    });
    return Buffer.from(base64, 'base64');
}

export async function setTileResponse(page: Page, tilePng: Buffer, status = 200) {
    await page.route('**/hot/**/*.png', async (route) => {
        await route.fulfill({
            status,
            contentType: status === 200 ? 'image/png' : 'text/html',
            headers: { 'access-control-allow-origin': '*' },
            body: status === 200 ? tilePng : 'Tile request failed'
        });
    });
}

export async function selectDistantGroupPoints(page: Page): Promise<Locator> {
    await waitForMapReady(page);
    await setMapZoom(page, 15);
    await page.locator('#modal-filter-button').click();
    await page.evaluate(() => {
        const app = (document.getElementById('app') as any).__vue_app__;
        const map = app.config.globalProperties.$pinia._s.get('map').map;
        map.setView([51, -1], 15, { animate: false });
    });
    await clickMap(page);
    await page.evaluate(() => {
        const app = (document.getElementById('app') as any).__vue_app__;
        const map = app.config.globalProperties.$pinia._s.get('map').map;
        map.setView([55, 3], 15, { animate: false });
    });
    await clickMap(page);
    await page.locator('#modal-filter-button').click();

    await page.evaluate(() => {
        const app = (document.getElementById('app') as any).__vue_app__;
        const pinia = app.config.globalProperties.$pinia;
        const map = pinia._s.get('map').map;
        const elements = Array.from(
            document.querySelectorAll('.leaflet-filters-pane path.modal-filter-marker')
        );
        if (elements.length !== 2) {
            throw new Error('Expected two modal filter marker elements');
        }
        const features = new Map<Element, any>();
        const findFeature = (layer: any) => {
            const element = layer.getElement?.();
            if (elements.includes(element) && layer.getLatLng) {
                features.set(element, layer);
            }
            layer.eachLayer?.(findFeature);
        };
        map.eachLayer(findFeature);
        if (features.size !== elements.length) {
            throw new Error('Modal filter marker layers not found');
        }

        const groupFeatures = elements.map((element) => features.get(element));
        const selection = pinia._s.get('selection');
        selection.setSelected(
            groupFeatures.map((feature) => ({
                layerId: 'ModalFilters',
                historyId: null,
                latLng: feature.getLatLng(),
                marker: feature
            }))
        );
        selection.markGroupSelection('export-group');
        map.setView([0, 0], 12, { animate: false });
    });
    await setMapZoom(page, 12);

    const markers = page.locator('.leaflet-filters-pane path.modal-filter-marker');
    await expect(markers).toHaveCount(2);
    await expect
        .poll(() => markers.first().evaluate((element) => getComputedStyle(element).visibility))
        .toBe('hidden');
    await expect
        .poll(() => markers.last().evaluate((element) => getComputedStyle(element).visibility))
        .toBe('hidden');
    return markers;
}
