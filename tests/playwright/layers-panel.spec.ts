import { test, expect } from '@playwright/test';
import { addFreshStorageInitScript, waitForFreshStorage } from './indexedDbHelpers';

test.describe('Map Manager Panel', () => {
    test.beforeEach(async ({ page }) => {
        await addFreshStorageInitScript(page);
        await page.goto('/');
        await waitForFreshStorage(page);
        await page.waitForSelector('.toolbar');
    });

    test('L toggles the Layers panel', async ({ page }) => {
        await page.keyboard.press('l');
        await expect(page.locator('#layers-panel')).toBeVisible();

        await page.keyboard.press('l');
        await expect(page.locator('#layers-panel')).not.toBeAttached();
    });

    test('Layers has a dedicated toolbar panel with visibility controls', async ({ page }) => {
        await page.locator('#layers-button').click();
        await expect(page.locator('#layers-panel')).toBeVisible();
        await expect(page.locator('#map-manager')).not.toBeAttached();
        await expect(page.getByLabel('Open layer Birmingham Wards')).toBeVisible();
        await expect(page.getByLabel('Show layer Birmingham Wards')).toBeVisible();
        await page.getByLabel('Open layer Birmingham Wards').click();
        await page.getByLabel('Rename Birmingham Wards').fill('l');
        await expect(page.locator('#layers-panel')).toBeVisible();
        await page.getByLabel('Rename Birmingham Wards').fill('Birmingham Wards');
        await page.getByRole('button', { name: 'Back to layers' }).click();

        await page.locator('#add-layer-button').click();
        await expect(page.locator('#add-layer-dialog')).toBeVisible();
        await expect(page.locator('#layers-panel')).toHaveAttribute('aria-hidden', 'true');
        await expect(page.locator('#layers-panel')).not.toHaveAttribute('aria-modal');
        await expect(page.locator('#add-layer-overlay')).toHaveCSS('z-index', '10003');
        await page.locator('#geojson-file').setInputFiles('src/public/Birmingham Wards.geojson');
        await expect(page.locator('#geojson-property-preview dl dt').first()).toBeAttached();
        await page.locator('#imported-name-property').selectOption({ label: 'wd25nm' });
        await page.locator('#imported-layer-name').fill('Imported Wards');
        await page.locator('#add-layer-dialog').getByRole('button', { name: 'Add layer' }).click();

        const layerItem = page.locator('#layers-list .layer-item').filter({
            has: page.getByLabel('Open layer Imported Wards')
        });
        const visibilityButton = layerItem.getByRole('button', { name: /^(Show|Hide) layer/ });
        await expect(visibilityButton).toHaveAttribute('aria-label', 'Hide layer Imported Wards');
        await visibilityButton.click();
        await expect(visibilityButton).toHaveAttribute('aria-label', 'Show layer Imported Wards');

        await page.locator('#settings-button').click();
        await page.locator('#read-only').check();
        await page.getByRole('button', { name: 'Save' }).click();
        await page.locator('#layers-button').click();
        await expect(page.locator('#layers-panel')).toBeVisible();
        await expect(page.locator('#layers-list .delete-button')).not.toBeAttached();

        const readOnlyVisibilityButton = layerItem.getByRole('button', {
            name: /^(Show|Hide) layer/
        });
        await expect(readOnlyVisibilityButton).toHaveAttribute(
            'aria-label',
            'Show layer Imported Wards'
        );
        await readOnlyVisibilityButton.click();
        await expect(readOnlyVisibilityButton).toHaveAttribute(
            'aria-label',
            'Hide layer Imported Wards'
        );
    });

    test('restores imported layers through history and stored map loading', async ({ page }) => {
        await page.route('**/history-layer.geojson', async (route) => {
            await route.fulfill({
                contentType: 'application/geo+json',
                body: JSON.stringify({
                    type: 'FeatureCollection',
                    features: [
                        {
                            type: 'Feature',
                            properties: { name: 'History feature' },
                            geometry: { type: 'Point', coordinates: [-1.9, 52.5] }
                        }
                    ]
                })
            });
        });

        await page.locator('#layers-button').click();
        await page.locator('#add-layer-button').click();
        await page.getByRole('button', { name: 'Load URL' }).click();
        await page.locator('#geojson-url').fill('http://localhost:1234/history-layer.geojson');
        await page.getByRole('button', { name: 'Load', exact: true }).click();
        await page.locator('#imported-layer-name').fill('History layer');
        await page.locator('#add-layer-dialog').getByRole('button', { name: 'Add layer' }).click();
        await expect(page.getByLabel('Open layer History layer')).toBeVisible();
        await expect(page.locator('#undo-button')).toBeEnabled();

        await page.locator('#undo-button').click();
        await expect(page.getByLabel('Open layer History layer')).not.toBeAttached();
        await page.locator('#redo-button').click();
        await expect(page.getByLabel('Open layer History layer')).toBeVisible();
        // Let the debounced save flush before switching away from this map.
        await page.waitForTimeout(500);

        await page.locator('#map-manager-button').click();
        await page.locator('#new-map').click();
        await page.locator('#new-map-title').fill('Imported Layer Reset');
        await page.locator('#create-new-map button').click();
        // Map creation closes the manager panel asynchronously; wait so it cannot
        // close the layers panel opened below.
        await expect(page.locator('#map-manager')).not.toBeAttached();
        await page.locator('#layers-button').click();
        await expect(page.getByLabel('Open layer History layer')).not.toBeAttached();
        await expect(page.getByLabel('Open layer Birmingham Wards')).toBeVisible();

        await page.locator('#map-manager-button').click();
        await page
            .locator('#map-list span.cursor-pointer')
            .filter({ hasText: 'Hello Cleveland' })
            .click();
        await expect(page.locator('#map-manager')).not.toBeAttached();
        await page.locator('#layers-button').click();
        await expect(page.getByLabel('Open layer History layer')).toBeVisible();
    });

    test('showing a hidden imported layer reuses its rendered geometry', async ({ page }) => {
        await page.evaluate(() => {
            const leaflet = (window as any).L;
            const originalGeoJSON = leaflet.geoJSON;
            (window as any).__geoJSONBuilds = 0;
            leaflet.geoJSON = (...args: any[]) => {
                (window as any).__geoJSONBuilds++;
                return originalGeoJSON(...args);
            };
        });

        await page.locator('#layers-button').click();
        await page.getByLabel('Show layer Birmingham Wards').click();
        await expect(page.getByLabel('Hide layer Birmingham Wards')).toBeVisible();
        const buildsAfterFirstShow = await page.evaluate(() => (window as any).__geoJSONBuilds);
        expect(buildsAfterFirstShow).toBeGreaterThan(0);

        await page.getByLabel('Hide layer Birmingham Wards').click();
        await page.getByLabel('Show layer Birmingham Wards').click();
        await expect(page.getByLabel('Hide layer Birmingham Wards')).toBeVisible();
        expect(await page.evaluate(() => (window as any).__geoJSONBuilds)).toBe(
            buildsAfterFirstShow
        );
    });
});
