import { expect, test } from '@playwright/test';
import type { useSettingsStore } from '../../src/stores/settingsStore';
import {
    addFirstNavigationStorageResetScript,
    getHistoryEntryCount,
    waitForFreshStorage
} from './indexedDbHelpers';
import {
    type AppElement,
    type TestPinia,
    type ImportedStore,
    type MapStore,
    seedItems,
    openItems
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

    test('preserves item state across closing and parent hiding, and keeps visibility in Presentation mode', async ({
        page
    }) => {
        await openItems(page);
        await page.getByRole('button', { name: 'Hide item Beta', exact: true }).click();
        await page.getByRole('button', { name: 'Back to layers' }).click();
        await page.getByRole('button', { name: 'Hide layer Named overlay', exact: true }).click();
        await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(1);
        await page.getByRole('button', { name: 'Open layer Named overlay', exact: true }).click();
        await expect(page.getByText('This layer is hidden.', { exact: false })).toBeVisible();
        await expect(
            page.getByRole('button', { name: 'Show only item Beta', exact: true })
        ).toBeVisible();
        await page.getByRole('button', { name: 'Show layer Named overlay', exact: true }).click();
        await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(6);
        await page.getByRole('button', { name: 'Close layers' }).click();
        await page.evaluate(() => {
            const stores = (
                (document.getElementById('app') as AppElement).__vue_app__.config.globalProperties
                    .$pinia as TestPinia
            )._s;
            (stores.get('settings') as ReturnType<typeof useSettingsStore>).readOnly = true;
        });
        await openItems(page);
        await expect(page.locator('#layer-details-name')).not.toBeAttached();
        await expect(
            page.getByRole('button', { name: 'Show only item Beta', exact: true })
        ).toBeVisible();
        await page.getByRole('button', { name: 'Show only item Beta', exact: true }).click();
        await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(2);
    });

    test('resets item choices when map data is restored and after a persisted map is reloaded', async ({
        page
    }) => {
        await openItems(page);
        await page.getByRole('button', { name: 'Hide item Beta', exact: true }).click();
        await page.evaluate(() => {
            const stores = (
                (document.getElementById('app') as AppElement).__vue_app__.config.globalProperties
                    .$pinia as TestPinia
            )._s;
            const store = stores.get('importedLayers') as ImportedStore;
            const source = JSON.parse(JSON.stringify(store.layers)) as typeof store.layers;
            store.setLayers(source);
        });
        await expect(
            page.getByRole('button', { name: 'Hide item Beta', exact: true })
        ).toBeVisible();
        await page.getByRole('button', { name: 'Hide item Beta', exact: true }).click();
        await expect(page.locator('#undo-button')).toBeEnabled();
        await page.reload();
        await waitForFreshStorage(page);
        await page.waitForSelector('.toolbar');
        await openItems(page);
        await expect(
            page.getByRole('button', { name: 'Hide item Beta', exact: true })
        ).toBeVisible();
    });

    for (const id of ['constructor', 'toString', '__proto__']) {
        test(`loads and controls a persisted layer whose ID is ${id}`, async ({ page }) => {
            const errors: string[] = [];
            page.on('pageerror', (error) => errors.push(error.message));
            await expect(page.locator('#undo-button')).toBeEnabled();
            const historyCount = await getHistoryEntryCount(page);
            await page.evaluate((layerId) => {
                const stores = (
                    (document.getElementById('app') as AppElement).__vue_app__.config
                        .globalProperties.$pinia as TestPinia
                )._s;
                const store = stores.get('importedLayers') as ImportedStore;
                const source = JSON.parse(
                    JSON.stringify(store.layers[0])
                ) as (typeof store.layers)[number];
                store.setLayers([{ ...source, id: layerId }]);
                (stores.get('map') as MapStore).markLayerUpdated();
            }, id);
            await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(6);
            await expect.poll(() => getHistoryEntryCount(page)).toBeGreaterThan(historyCount);
            await page.reload();
            await waitForFreshStorage(page);
            await page.waitForSelector('.toolbar');
            await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(6);
            expect(
                await page.evaluate(() => {
                    const stores = (
                        (document.getElementById('app') as AppElement).__vue_app__.config
                            .globalProperties.$pinia as TestPinia
                    )._s;
                    return (stores.get('importedLayers') as ImportedStore).layers.map(
                        (layer) => layer.id
                    );
                })
            ).toEqual([id]);
            await openItems(page);
            await page.getByRole('button', { name: 'Hide item Beta', exact: true }).click();
            await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(5);
            await page.getByRole('button', { name: 'Show only item Beta', exact: true }).click();
            await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(1);
            await expect(page.locator('#layer-items-list [data-visibility="solo"]')).toHaveCount(1);
            await page.getByRole('button', { name: 'Show all items', exact: true }).first().click();
            await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(6);
            expect(errors).toEqual([]);
        });
    }

    test('keeps details usable at narrow viewport sizes', async ({ page }) => {
        await page.setViewportSize({ width: 360, height: 640 });
        await openItems(page);
        const dialog = page.getByRole('dialog', { name: 'Named overlay' });
        const bounds = await dialog.boundingBox();
        expect(bounds).not.toBeNull();
        expect(bounds!.x).toBeGreaterThanOrEqual(0);
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(360);
        await page.getByLabel('Search by name').fill('Mixed');
        await page.getByRole('button', { name: 'Hide item Mixed', exact: true }).click();
        await expect(
            page.getByRole('button', { name: 'Show only item Mixed', exact: true })
        ).toBeVisible();
    });
});
