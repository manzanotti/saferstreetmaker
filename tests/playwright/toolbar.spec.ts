import { test, expect } from '@playwright/test';
import { addFreshStorageInitScript, waitForFreshStorage } from './indexedDbHelpers';

test.describe('Toolbar', () => {
    test.beforeEach(async ({ page }) => {
        await addFreshStorageInitScript(page);
        await page.goto('/');
        await waitForFreshStorage(page);
        // Wait for the toolbar to be rendered by Leaflet
        await page.waitForSelector('.toolbar');
    });

    test('toolbar is visible', async ({ page }) => {
        await expect(page.locator('.toolbar')).toBeVisible();
    });

    test('layer toolbar is positioned in the map control stack and contains layer buttons', async ({
        page
    }) => {
        const layerToolbar = page.locator('.leaflet-top.leaflet-left .leaflet-control .toolbar');
        await expect(layerToolbar).toBeVisible();
        await expect(layerToolbar.locator('> li > button')).toHaveCount(9);
        await expect(layerToolbar.locator('#modal-filter-button')).toBeVisible();
        await expect(layerToolbar.locator('#mobility-lane-button')).toBeVisible();
        await expect(layerToolbar.locator('#junction-narrowing-button')).toBeVisible();

        const map = await page.locator('#map').boundingBox();
        const toolbar = await layerToolbar.boundingBox();
        expect(map).not.toBeNull();
        expect(toolbar).not.toBeNull();
        expect(toolbar!.x).toBeGreaterThanOrEqual(map!.x);
        expect(toolbar!.y).toBeGreaterThanOrEqual(map!.y);
        expect(toolbar!.x).toBeLessThan(map!.x + 120);
        expect(toolbar!.y).toBeLessThan(map!.y + 120);
    });

    test('help button is present', async ({ page }) => {
        await expect(page.locator('#help-button')).toBeVisible();
    });

    test('settings button is present', async ({ page }) => {
        await expect(page.locator('#settings-button')).toBeVisible();
    });

    test('map manager button is present', async ({ page }) => {
        await expect(page.locator('#map-manager-button')).toBeVisible();
    });

    test('undo and redo buttons are present', async ({ page }) => {
        await expect(page.locator('#undo-button')).toBeVisible();
        await expect(page.locator('#redo-button')).toBeVisible();
    });

    test('share button is present', async ({ page }) => {
        await expect(page.locator('#share-button')).toBeVisible();
    });

    test('modal filter layer button is present', async ({ page }) => {
        await expect(page.locator('#modal-filter-button')).toBeVisible();
    });

    test('mobility lane button is present', async ({ page }) => {
        await expect(page.locator('#mobility-lane-button')).toBeVisible();
    });

    test('car free street button is present', async ({ page }) => {
        await expect(page.locator('#car-free-street-button')).toBeVisible();
    });

    test('school street button is present', async ({ page }) => {
        await expect(page.locator('#school-street-button')).toBeVisible();
    });
});

test.describe('Mobile map controls', () => {
    test.use({ viewport: { width: 320, height: 360 }, isMobile: true, hasTouch: true });

    test('toolbar and legend remain accessible on a short phone screen', async ({ page }) => {
        await page.goto('/');
        const toolbar = page.locator('.leaflet-top.leaflet-left .toolbar');
        const legendHeader = page.locator('.legend-title');
        const firstLegendRow = page.locator('.legend li').first();
        const lastTool = toolbar.locator('> li > button').last();

        await expect(toolbar).toBeVisible();
        await expect(toolbar).toHaveAttribute('aria-orientation', 'horizontal');
        await expect(legendHeader).toBeVisible();
        await expect(firstLegendRow).toBeVisible();
        await expect(lastTool).toBeVisible();
        await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
            'content',
            'width=device-width, initial-scale=1.0'
        );

        for (const control of [toolbar, legendHeader, firstLegendRow, lastTool]) {
            const bounds = await control.boundingBox();
            expect(bounds).not.toBeNull();
            expect(bounds!.y).toBeGreaterThanOrEqual(0);
            expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(360);
        }

        for (const button of await toolbar.locator('> li > button').all()) {
            const bounds = await button.boundingBox();
            expect(bounds).not.toBeNull();
            expect(bounds!.width).toBeGreaterThanOrEqual(44);
            expect(bounds!.height).toBeGreaterThanOrEqual(44);
            expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(360);
        }

        const legendContent = page.locator('.legend-content');
        await expect
            .poll(() =>
                legendContent.evaluate((element) => element.scrollHeight > element.clientHeight)
            )
            .toBe(true);
        await legendContent.evaluate((element) => (element.scrollTop = element.scrollHeight));
        await expect(legendHeader).toBeInViewport();
        await expect(page.locator('.legend li').last()).toBeInViewport();

        const legendBounds = await page.locator('.legend').boundingBox();
        expect(legendBounds).not.toBeNull();
        await page.locator('#modal-filter-button').click({ button: 'right' });
        const filtersMenu = toolbar.getByRole('group', { name: 'filters options' });
        await expect(filtersMenu).toBeVisible();
        const filtersBounds = await filtersMenu.boundingBox();
        const nextRowBounds = await page.locator('#tram-line-button').boundingBox();
        expect(filtersBounds).not.toBeNull();
        expect(nextRowBounds).not.toBeNull();
        expect(filtersBounds!.x).toBeGreaterThanOrEqual(nextRowBounds!.x + nextRowBounds!.width);
        expect(filtersBounds!.x + filtersBounds!.width).toBeLessThan(legendBounds!.x);
        await expect(page.locator('#tram-line-button')).toBeInViewport();

        await page.locator('#traffic-lights-button').click({ button: 'right' });
        const submenu = toolbar.getByRole('group', { name: 'traffic-controls options' });
        await expect(submenu).toBeVisible();
        const submenuBounds = await submenu.boundingBox();
        expect(submenuBounds).not.toBeNull();
        expect(submenuBounds!.y).toBeGreaterThanOrEqual(0);
        expect(submenuBounds!.y + submenuBounds!.height).toBeLessThanOrEqual(360);
        expect(submenuBounds!.x + submenuBounds!.width).toBeLessThan(legendBounds!.x);
        for (const button of await submenu.locator('button').all()) {
            const bounds = await button.boundingBox();
            expect(bounds).not.toBeNull();
            expect(bounds!.width).toBeGreaterThanOrEqual(44);
            expect(bounds!.height).toBeGreaterThanOrEqual(44);
        }

        await page.setViewportSize({ width: 800, height: 600 });
        await expect(toolbar).toHaveAttribute('aria-orientation', 'vertical');
    });
});

test.describe('hide-toolbar URL parameter', () => {
    test('toolbar is hidden when hide-toolbar=true is in the URL', async ({ page }) => {
        await page.goto('/?hide-toolbar=true');
        // The Leaflet map container should appear without a toolbar
        await page.waitForSelector('#map');
        await page.waitForTimeout(500); // allow map + settings to initialise
        await expect(page.locator('.toolbar')).not.toBeAttached();
    });

    test('toolbar is visible when hide-toolbar is absent', async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('.toolbar');
        await expect(page.locator('.toolbar')).toBeVisible();
    });
});
