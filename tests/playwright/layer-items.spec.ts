import { expect, test } from '@playwright/test';
import { addFirstNavigationStorageResetScript, waitForFreshStorage } from './indexedDbHelpers';
import {
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

    test('opens accessible details, searches named features, renames, and restores keyboard focus', async ({
        page
    }) => {
        await openItems(page);
        await expect(page.getByRole('dialog')).toHaveCount(1);
        await expect(page.locator('#layer-items-list li')).toHaveCount(5);
        await page.locator('#layer-items-list button').last().focus();
        await page.keyboard.press('Tab');
        await expect(page.getByRole('button', { name: 'Back to layers' })).toBeFocused();
        const search = page.getByLabel('Search by name');
        await search.fill(' ALp ');
        await expect(page.locator('#layer-items-list li')).toHaveCount(2);
        await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(7);
        await search.fill('nothing');
        await expect(page.getByText('No items match your search.')).toBeVisible();
        await search.fill('l');
        await expect(page.locator('#layer-items-panel')).toBeVisible();
        await page.getByLabel('Rename Named overlay').fill('Renamed overlay');
        await search.click();
        await expect(page.getByRole('dialog', { name: 'Renamed overlay' })).toBeVisible();
        await search.press('Escape');
        await expect(page.getByLabel('Open layer Renamed overlay')).toBeFocused();
        await page.keyboard.press('Enter');
        await expect(search).toBeFocused();
        await search.press('Shift+Tab');
        await expect(page.getByLabel('Rename Renamed overlay')).toBeFocused();
        await page.getByRole('button', { name: 'Close layers' }).click();
        await expect(page.locator('#layers-button')).toBeFocused();
    });

    test('orders named items alphabetically after filtering and editing a feature name', async ({
        page
    }) => {
        await openItems(page);
        const rows = page.locator('#layer-items-list li');
        const names = rows.locator('> button:first-child');
        await expect(names).toHaveText(['Alpha', 'Alpha', 'Beta', 'Metadata', 'Mixed']);
        expect(
            await rows.evaluateAll((items) =>
                items.map((item) => item.getAttribute('data-feature-index'))
            )
        ).toEqual(['1', '3', '2', '0', '5']);

        const search = page.getByLabel('Search by name');
        await search.fill('a');
        await expect(names).toHaveText(['Alpha', 'Alpha', 'Beta', 'Metadata']);
        await search.clear();
        await page.getByRole('button', { name: 'Close layers' }).click();

        const beta = page.locator('.leaflet-imported-pane path').nth(1);
        const bounds = await beta.boundingBox();
        if (!bounds) {
            throw new Error('Beta feature bounding box not found');
        }
        await beta.dispatchEvent('click', {
            clientX: bounds.x + bounds.width / 2,
            clientY: bounds.y + bounds.height / 2
        });
        const editor = page.getByRole('textbox', { name: 'Feature title' });
        await expect(editor).toHaveValue('Beta');
        await editor.fill('Aardvark');
        await editor.press('Enter');

        await openItems(page);
        await expect(names).toHaveText(['Aardvark', 'Alpha', 'Alpha', 'Metadata', 'Mixed']);
        await expect(rows.first()).toHaveAttribute('data-feature-index', '2');
        await page.getByRole('button', { name: 'Hide item Aardvark', exact: true }).click();
        await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(6);
    });

    test('cycles actual map features and isolates only the chosen layer without rebuilding geometry', async ({
        page
    }) => {
        await openItems(page);
        await trackGeometryBuilds(page);
        const alpha = page.locator(
            '#layer-items-list li[data-feature-index="1"] button[data-visibility]'
        );
        const duplicate = page.locator(
            '#layer-items-list li[data-feature-index="3"] button[data-visibility]'
        );
        await alpha.click();
        await expect(alpha).toHaveAttribute('data-visibility', 'hidden');
        await expect(duplicate).toHaveAttribute('data-visibility', 'visible');
        await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(6);
        await alpha.click();
        await expect(alpha).toHaveAttribute('data-visibility', 'solo');
        await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(2);
        await expect(page.locator('.leaflet-filters-pane .modal-filter-marker')).toHaveCount(1);
        await duplicate.click();
        await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(7);
        await expect(alpha).toHaveAttribute('data-visibility', 'visible');
        const mixed = page.locator(
            '#layer-items-list li[data-feature-index="5"] button[data-visibility]'
        );
        await mixed.click();
        await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(5);
        await mixed.click();
        await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(3);
        await page.getByRole('button', { name: 'Show all items', exact: true }).last().click();
        await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(7);
        await page.getByLabel('Search by name').fill('Beta');
        await page.getByRole('button', { name: 'Hide all items', exact: true }).click();
        await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(1);
        await page.getByRole('button', { name: 'Show all items', exact: true }).click();
        await expect(page.locator('.leaflet-imported-pane path')).toHaveCount(7);
        expect(
            await page.evaluate(() => (window as TestWindow).layerItemGeometryBuilds?.count)
        ).toBe(0);
    });
});
