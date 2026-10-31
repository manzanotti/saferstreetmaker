import { Buffer } from 'node:buffer';
import { expect, test, type Page } from '@playwright/test';
import {
    addFreshStorageInitScript,
    getLayerFeatures,
    waitForFreshStorage
} from './indexedDbHelpers';

async function uploadMap(page: Page, layers: Record<string, unknown>, activeLayers: string[]) {
    const map = {
        settings: {
            title: 'Imported compatibility map',
            readOnly: false,
            hideToolbar: false,
            activeLayers,
            centre: { lat: 52.5, lng: -1.9 },
            zoom: 12,
            version: '0.9.0'
        },
        layers
    };
    await page.locator('#map-manager-button').click();
    await page.locator('#load-file').click();
    await page.locator('input[type="file"]').setInputFiles({
        name: 'map.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(map))
    });
}

test.describe('Stored map layer compatibility', () => {
    test.beforeEach(async ({ page }) => {
        await addFreshStorageInitScript(page);
        await page.goto('/');
        await waitForFreshStorage(page);
        await page.waitForSelector('.toolbar');
    });

    test('imports legacy nested cycle-lane coordinates with their identity', async ({ page }) => {
        await uploadMap(
            page,
            {
                CycleLanes: {
                    features: [
                        {
                            geometry: {
                                type: 'LineString',
                                coordinates: [
                                    [
                                        [-1.9, 52.5],
                                        [-1.8, 52.6]
                                    ]
                                ]
                            },
                            properties: { historyId: 'old-lane', name: 'Old lane' }
                        }
                    ]
                }
            },
            ['MobilityLanes']
        );

        await expect(page.locator('path.mobility-lane')).toHaveCount(1);
        await expect
            .poll(() => getLayerFeatures(page, 'Imported compatibility map', 'MobilityLanes'))
            .toMatchObject([{ properties: { historyId: 'old-lane', name: 'Old lane' } }]);
    });

    test('reports invalid layer coordinates when importing a map', async ({ page }) => {
        await uploadMap(
            page,
            {
                BusGates: {
                    type: 'FeatureCollection',
                    features: [
                        {
                            type: 'Feature',
                            geometry: { type: 'Point', coordinates: ['invalid', 52.5] },
                            properties: {}
                        }
                    ]
                }
            },
            ['BusGates']
        );

        await expect(page.getByRole('dialog', { name: 'An error has occurred' })).toContainText(
            'Layer "BusGates", feature 1 has invalid coordinates.'
        );
    });
});
