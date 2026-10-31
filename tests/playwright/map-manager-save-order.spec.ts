import { expect, test } from '@playwright/test';
import {
    addFreshStorageInitScript,
    getLayerFeatureCount,
    waitForFreshStorage
} from './indexedDbHelpers';
import { waitForMapReady } from './layers/layerMapTestHelpers';

test('switching immediately after an edit preserves the old map and its history', async ({
    page,
    context
}) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 52.5, longitude: -1.9 });
    await addFreshStorageInitScript(page);
    await page.goto('/');
    await waitForFreshStorage(page);
    await waitForMapReady(page);
    await page.locator('#modal-filter-button').click();
    const map = page.locator('#map');
    const box = await map.boundingBox();
    if (!box) {
        throw new Error('Map bounding box not found');
    }
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

    await page.locator('#map-manager-button').click();
    await page.locator('#new-map').click();
    await page.locator('#new-map-title').fill('Next map');
    await page.locator('#create-new-map button').click();
    await expect(page.locator('.leaflet-filters-pane path.modal-filter-marker')).toHaveCount(0);
    await expect(page.locator('#undo-button')).toBeDisabled();
    await expect.poll(() => getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(1);

    await page.locator('#map-manager-button').click();
    await page
        .locator('#map-list span.cursor-pointer')
        .filter({ hasText: 'Hello Cleveland' })
        .click();
    await expect(page.locator('.leaflet-filters-pane path.modal-filter-marker')).toHaveCount(1);
    await expect(page.locator('#undo-button')).toBeEnabled();
    await page.locator('#undo-button').click();
    await expect(page.locator('.leaflet-filters-pane path.modal-filter-marker')).toHaveCount(0);
});
