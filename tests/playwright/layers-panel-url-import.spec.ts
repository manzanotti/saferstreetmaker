import { test, expect } from '@playwright/test';
import { addFreshStorageInitScript, waitForFreshStorage } from './indexedDbHelpers';

test.describe('Map Manager Panel', () => {
    test.beforeEach(async ({ page }) => {
        await addFreshStorageInitScript(page);
        await page.goto('/');
        await waitForFreshStorage(page);
        await page.waitForSelector('.toolbar');
    });

    test('imports a GeoJSON layer from a URL and resets file data when switching source', async ({
        page
    }) => {
        await page.route('**/url-layer.geojson', async (route) => {
            await route.fulfill({
                contentType: 'application/geo+json',
                body: JSON.stringify({
                    type: 'FeatureCollection',
                    features: [
                        {
                            type: 'Feature',
                            properties: { name: 'URL feature' },
                            geometry: { type: 'Point', coordinates: [-1.9, 52.5] }
                        }
                    ]
                })
            });
        });

        await page.locator('#layers-button').click();
        await page.locator('#add-layer-button').click();
        await page.locator('#geojson-file').setInputFiles('src/public/Birmingham Wards.geojson');
        await expect(page.locator('#imported-layer-name')).toBeVisible();

        await page.getByRole('button', { name: 'Load URL' }).click();
        await expect(page.locator('#imported-layer-name')).not.toBeAttached();
        await page.locator('#geojson-url').fill('http://localhost:1234/url-layer.geojson');
        await page.getByRole('button', { name: 'Load', exact: true }).click();

        await expect(page.locator('#imported-layer-name')).toHaveValue('url-layer');
        await page.locator('#imported-layer-name').fill('URL layer');
        await page.locator('#add-layer-dialog').getByRole('button', { name: 'Add layer' }).click();
        await expect(page.getByLabel('Open layer URL layer')).toBeVisible();
    });

    test('shows validation feedback when a URL returns invalid GeoJSON', async ({ page }) => {
        await page.route('**/invalid-layer.geojson', async (route) => {
            await route.fulfill({
                contentType: 'application/geo+json',
                body: JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature' }] })
            });
        });

        await page.locator('#layers-button').click();
        await page.locator('#add-layer-button').click();
        await page.getByRole('button', { name: 'Load URL' }).click();
        await page.locator('#geojson-url').fill('http://localhost:1234/invalid-layer.geojson');
        await page.getByRole('button', { name: 'Load', exact: true }).click();

        await expect(page.locator('#add-layer-dialog')).toContainText('Could not load GeoJSON.');
        await expect(page.locator('#imported-layer-name')).not.toBeAttached();
    });

    test('clears loaded GeoJSON when its URL is edited', async ({ page }) => {
        await page.route('**/first-layer.geojson', async (route) => {
            await route.fulfill({
                contentType: 'application/geo+json',
                body: JSON.stringify({
                    type: 'FeatureCollection',
                    features: [
                        {
                            type: 'Feature',
                            properties: { name: 'First feature' },
                            geometry: { type: 'Point', coordinates: [-1.9, 52.5] }
                        }
                    ]
                })
            });
        });

        await page.locator('#layers-button').click();
        await page.locator('#add-layer-button').click();
        await page.getByRole('button', { name: 'Load URL' }).click();
        await page.locator('#geojson-url').fill('http://localhost:1234/first-layer.geojson');
        await page.getByRole('button', { name: 'Load', exact: true }).click();
        await expect(page.locator('#imported-layer-name')).toHaveValue('first-layer');

        await page.locator('#geojson-url').fill('http://localhost:1234/second-layer.geojson');

        await expect(page.locator('#imported-layer-name')).not.toBeAttached();
        await page.locator('#add-layer-dialog').getByRole('button', { name: 'Add layer' }).click();
        await expect(page.locator('#add-layer-dialog')).toContainText(
            'Choose a file or load a URL before adding a layer.'
        );
    });

    test('ignores a URL response that resolves after switching to file upload', async ({
        page
    }) => {
        let releaseResponse!: () => void;
        const responseBlocked = new Promise<void>((resolve) => {
            releaseResponse = resolve;
        });
        await page.route('**/delayed-layer.geojson', async (route) => {
            await responseBlocked;
            await route.fulfill({
                contentType: 'application/geo+json',
                body: JSON.stringify({
                    type: 'FeatureCollection',
                    features: [
                        {
                            type: 'Feature',
                            properties: { name: 'Stale feature' },
                            geometry: { type: 'Point', coordinates: [-1.9, 52.5] }
                        }
                    ]
                })
            });
        });

        await page.locator('#layers-button').click();
        await page.locator('#add-layer-button').click();
        await page.getByRole('button', { name: 'Load URL' }).click();
        await page.locator('#geojson-url').fill('http://localhost:1234/delayed-layer.geojson');
        await page.getByRole('button', { name: 'Load', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Loading...' })).toBeVisible();

        await page.getByRole('button', { name: 'Upload file' }).click();
        releaseResponse();

        await expect(page.locator('#imported-layer-name')).not.toBeAttached();
    });
});
