import { test, expect } from '@playwright/test';
import { Buffer } from 'node:buffer';
import {
    addFreshStorageInitScript,
    getLayerFeatureCount,
    seedStoredMap,
    waitForFreshStorage
} from './indexedDbHelpers';

test.describe('Map Manager Panel', () => {
    test.beforeEach(async ({ page }) => {
        await addFreshStorageInitScript(page);
        await page.goto('/');
        await waitForFreshStorage(page);
        await page.waitForSelector('.toolbar');
    });

    test('map manager panel is not visible on load', async ({ page }) => {
        await expect(page.locator('#map-manager')).not.toBeAttached();
    });

    test('clicking map manager button opens the panel', async ({ page }) => {
        await page.locator('#map-manager-button').click();
        await expect(page.locator('#map-manager')).toBeVisible();
    });

    test('pressing Escape closes the map manager panel', async ({ page }) => {
        await page.locator('#map-manager-button').click();
        await page.locator('#map-manager button').first().focus();
        await page.keyboard.press('Escape');

        await expect(page.locator('#map-manager')).not.toBeAttached();
        await expect(page.locator('#map-manager-button')).toBeFocused();
    });

    test('loading a JSON file replaces the map and persists the uploaded data', async ({
        page
    }) => {
        const uploadedMap = {
            settings: {
                title: 'Uploaded Test Map',
                readOnly: false,
                hideToolbar: false,
                activeLayers: ['BusGates'],
                centre: { lat: 52.5, lng: -1.9 },
                zoom: 12,
                version: '0.9.0'
            },
            layers: {
                BusGates: {
                    type: 'FeatureCollection',
                    features: [
                        {
                            type: 'Feature',
                            properties: {},
                            geometry: {
                                type: 'Point',
                                coordinates: [-1.9, 52.5]
                            }
                        }
                    ]
                }
            }
        };

        await page.locator('#map-manager-button').click();
        await page.locator('#load-file').click();

        const fileInput = page.locator('input[type="file"]');
        await expect(fileInput).toBeAttached();
        await fileInput.setInputFiles({
            name: 'uploaded-test-map.json',
            mimeType: 'application/json',
            buffer: Buffer.from(JSON.stringify(uploadedMap))
        });

        await expect(page.locator('#map-manager')).not.toBeAttached();
        await expect(page.locator('.leaflet-marker-icon.bus-gate-icon')).toHaveCount(1);
        await expect
            .poll(() => getLayerFeatureCount(page, 'Uploaded Test Map', 'BusGates'))
            .toBe(1);
    });

    test('clicking map manager button a second time closes the panel', async ({ page }) => {
        const button = page.locator('#map-manager-button');
        await button.click(); // open
        await expect(page.locator('#map-manager')).toBeVisible();
        await button.click(); // close
        await expect(page.locator('#map-manager')).not.toBeAttached();
    });

    test('clicking the new map control reveals the create-map form', async ({ page }) => {
        await page.locator('#map-manager-button').click();
        await page.locator('#new-map').click();
        await expect(page.locator('#create-new-map')).toBeVisible();
    });

    test('clicking the copy map control creates another stored map entry', async ({ page }) => {
        await seedStoredMap(page, 'Hello Cleveland');

        await page.locator('#map-manager-button').click();
        await page.locator('#copy-map').click();

        await expect(page.locator('#map-list li')).toHaveCount(2);
    });

    test('clicking create in the new map form shows the duplicate-title error for existing names', async ({
        page
    }) => {
        await seedStoredMap(page, 'Hello Cleveland');

        await page.locator('#map-manager-button').click();
        await page.locator('#new-map').click();
        await page.locator('#new-map-title').fill('Hello Cleveland');
        await page.locator('#create-new-map button').click();

        await expect(page.locator('#duplicate-title-error')).toContainText(
            'You already have a map named Hello Cleveland'
        );
    });
});
