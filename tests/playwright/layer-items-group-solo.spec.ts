import { expect, test } from '@playwright/test';
import { addFirstNavigationStorageResetScript, waitForFreshStorage } from './indexedDbHelpers';
import {
    type TestWindow,
    seedItems,
    openItems,
    trackGeometryBuilds,
    seedPlanningGroup,
    soloPlanningGroup
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

    test('restores hidden item and parent-layer choices after group solo without rebuilding geometry', async ({
        page
    }) => {
        await seedPlanningGroup(page);
        await trackGeometryBuilds(page);
        await openItems(page);
        await page.getByRole('button', { name: 'Hide item Beta', exact: true }).click();
        await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(5);
        await page.getByRole('button', { name: 'Close layers' }).click();
        await soloPlanningGroup(page);
        await page.getByRole('button', { name: 'Show all groups', exact: true }).click();
        await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(5);

        await page.locator('#layers-button').click();
        await expect(
            page.getByRole('button', { name: 'Show layer Other overlay', exact: true })
        ).toBeVisible();
        await page.getByRole('button', { name: 'Open layer Named overlay', exact: true }).click();
        await expect(
            page.getByRole('button', { name: 'Show only item Beta', exact: true })
        ).toBeVisible();
        await page.getByRole('button', { name: 'Hide all items', exact: true }).click();
        await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(0);
        await page.getByRole('button', { name: 'Show all items', exact: true }).click();
        await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(6);
        expect(
            await page.evaluate(() => (window as TestWindow).layerItemGeometryBuilds?.count)
        ).toBe(0);
    });

    test('allows item solo changes during group solo without revealing suppressed or hidden layers', async ({
        page
    }) => {
        await seedPlanningGroup(page);
        await trackGeometryBuilds(page);
        await openItems(page);
        await page.getByRole('button', { name: 'Hide item Beta', exact: true }).click();
        await page.getByRole('button', { name: 'Close layers' }).click();
        await soloPlanningGroup(page);
        await openItems(page);
        await page.getByRole('button', { name: 'Show only item Beta', exact: true }).click();
        await expect(page.locator('#layer-items-list [data-visibility="solo"]')).toHaveCount(1);
        await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(0);
        await page.getByRole('button', { name: 'Close layers' }).click();
        await page.locator('#groups-button').click();
        await page.getByRole('button', { name: 'Show all groups', exact: true }).click();
        await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(1);
        await openItems(page);
        await expect(page.locator('#layer-items-list [data-visibility="solo"]')).toHaveCount(1);
        await page.getByRole('button', { name: 'Show all items', exact: true }).first().click();
        await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(6);
        expect(
            await page.evaluate(() => (window as TestWindow).layerItemGeometryBuilds?.count)
        ).toBe(0);
    });
});
