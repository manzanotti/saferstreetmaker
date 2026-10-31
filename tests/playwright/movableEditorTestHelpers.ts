import { expect, type Locator, type Page } from '@playwright/test';
import type { App } from 'vue';
import type { useMapStore } from '../../src/stores/mapStore';

export async function resizeMapViewport(page: Page, width: number, height: number) {
    await page.setViewportSize({ width, height });
    await page.waitForFunction((expectedWidth) => {
        const root = document.getElementById('app') as HTMLElement & { __vue_app__: App };
        const mapStore = root.__vue_app__.config.globalProperties.$pinia._s.get(
            'map'
        ) as ReturnType<typeof useMapStore>;
        return mapStore.map?.getSize().x === expectedWidth;
    }, width);
}

export async function dragEditor(page: Page, popup: Locator, dx = 60, dy = 25) {
    const before = await popup.boundingBox();
    const heading = await popup.locator('.feature-popup-groups > strong').boundingBox();
    const mapStyle = await page.locator('.leaflet-map-pane').getAttribute('style');
    await page.mouse.move(heading!.x + 10, heading!.y + 5);
    await page.mouse.down();
    await expect(popup).toHaveCSS('cursor', 'move');
    await page.mouse.move(heading!.x + 10 + dx, heading!.y + 5 + dy, { steps: 10 });
    await page.mouse.up();
    const after = await popup.boundingBox();
    expect(after!.x - before!.x).toBeCloseTo(dx, 0);
    expect(after!.y - before!.y).toBeCloseTo(dy, 0);
    expect(await page.locator('.leaflet-map-pane').getAttribute('style')).toBe(mapStyle);
}
