import { expect, test } from '@playwright/test';
import { addFirstNavigationStorageResetScript, waitForFreshStorage } from './indexedDbHelpers';
import {
    type AppElement,
    type TestPinia,
    type ImportedStore,
    type MapStore,
    type TestWindow,
    seedItems,
    openItems,
    trackGeometryBuilds
} from './layerItemsTestHelpers';

test.describe('Named items in imported layers', () => {
    test.beforeEach(async ({ page, context }) => {
        await context.grantPermissions(['geolocation']);
        await context.setGeolocation({ latitude: 52.5, longitude: -1.9 });
        await addFirstNavigationStorageResetScript(page);
        await page.goto('/');
        await waitForFreshStorage(page);
        await page.waitForSelector('.toolbar');
        await page.addStyleTag({ content: '#help { display: none !important; }' });
        await page.waitForFunction(() =>
            Array.from(document.getElementById('map')?.classList ?? []).some((name) =>
                name.startsWith('zoom-')
            )
        );
        await seedItems(page);
    });

    test('centres named features by click and keyboard while preserving zoom, visibility and the panel', async ({
        page
    }) => {
        await openItems(page);
        const view = () =>
            page.evaluate(() => {
                const stores = (
                    (document.getElementById('app') as AppElement).__vue_app__.config
                        .globalProperties.$pinia as TestPinia
                )._s;
                const map = (stores.get('map') as MapStore).map!;
                const centre = map.getCenter();
                return { lat: centre.lat, lng: centre.lng, zoom: map.getZoom() };
            });
        const expectCentre = async (lat: number, lng: number) => {
            await expect.poll(async () => (await view()).lat).toBeCloseTo(lat, 4);
            await expect.poll(async () => (await view()).lng).toBeCloseTo(lng, 4);
            expect((await view()).zoom).toBe(18);
        };
        await expect(
            page.getByRole('button', { name: 'Centre map on Metadata', exact: true })
        ).toBeDisabled();
        const before = await view();
        await page.getByRole('button', { name: 'Hide item Beta', exact: true }).click();
        expect(await view()).toEqual(before);
        await page.getByRole('button', { name: 'Centre map on Beta', exact: true }).click();
        await expectCentre(52.5015, -1.9025);
        await expect(
            page.getByRole('button', { name: 'Show only item Beta', exact: true })
        ).toBeVisible();

        await page.getByLabel('Search by name').fill('Alpha');
        const names = page.getByRole('button', { name: 'Centre map on Alpha', exact: true });
        await names.nth(1).focus();
        await page.keyboard.press('Enter');
        await expectCentre(52.5015, -1.9005);
        await names.first().focus();
        await page.keyboard.press('Space');
        await expectCentre(52.5015, -1.9045);
        await expect(page.locator('#layer-items-panel')).toBeVisible();
        await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(6);
    });

    test('searches and controls a 1000-item layer within UI deadlines without rebuilding geometry', async ({
        page
    }) => {
        await trackGeometryBuilds(page);
        await page.evaluate(() => {
            const stores = (
                (document.getElementById('app') as AppElement).__vue_app__.config.globalProperties
                    .$pinia as TestPinia
            )._s;
            (stores.get('importedLayers') as ImportedStore).setLayers([
                {
                    id: 'large',
                    name: 'Large overlay',
                    nameProperty: 'name',
                    featureCollection: {
                        type: 'FeatureCollection',
                        features: Array.from({ length: 1000 }, (_, index) => ({
                            type: 'Feature',
                            properties: { name: `Street ${String(index).padStart(4, '0')}` },
                            geometry: {
                                type: 'Point',
                                coordinates: [
                                    -1.905 + (index % 50) * 0.0001,
                                    52.5 + Math.floor(index / 50) * 0.0001
                                ]
                            }
                        }))
                    }
                }
            ]);
        });
        await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(1000);
        await page.locator('#layers-button').click();
        await page.getByRole('button', { name: 'Open layer Large overlay', exact: true }).click();
        await expect(page.locator('#layer-items-list li')).toHaveCount(1000);
        const search = page.getByLabel('Search by name');
        await search.fill('Street 099');
        await expect(page.locator('#layer-items-list li')).toHaveCount(10);
        await page.getByRole('button', { name: 'Hide item Street 0990', exact: true }).click();
        await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(999);
        await page.getByRole('button', { name: 'Show only item Street 0990', exact: true }).click();
        await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(1);
        await page.getByRole('button', { name: 'Show all items', exact: true }).first().click();
        await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(1000);
        await search.clear();
        await expect(page.locator('#layer-items-list li')).toHaveCount(1000);
        expect(
            await page.evaluate(() => (window as TestWindow).layerItemGeometryBuilds?.count)
        ).toBe(1);
    });
});
