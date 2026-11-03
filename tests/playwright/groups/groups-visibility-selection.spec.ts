import { test, expect } from '@playwright/test';
import { setupPage, dragSelectCenter, openGroupsPanel } from './groupTestHelpers';
import { seedIsolationMap } from './groupVisibilityTestHelpers';

test.describe('Groups — Visibility', () => {
    test.beforeEach(async ({ page, context }) => {
        await setupPage(page, context);
    });

    test('hiding an edited feature ends layer edit mode without reviving it on exit', async ({
        page
    }) => {
        await seedIsolationMap(page);
        await page.locator('[data-fixture="lane"]').dispatchEvent('click');
        await expect(page.locator('.leaflet-editing-icon').first()).toBeVisible();
        const activeLayer = () =>
            page.evaluate(
                () =>
                    (
                        document.getElementById('app') as any
                    ).__vue_app__.config.globalProperties.$pinia._s.get('map').activeLayerId
            );
        expect(await activeLayer()).toBe('mobility-lane');
        await openGroupsPanel(page);
        await page.getByRole('button', { name: 'Hide group Proposal', exact: true }).click();
        expect(await activeLayer()).toBeNull();
        await expect(page.locator('.leaflet-editing-icon')).toHaveCount(0);
        await page.getByRole('button', { name: 'Show only group Proposal' }).click();
        await page.locator('[data-visibility="solo"]').click();
        expect(await activeLayer()).toBeNull();
        await expect(page.locator('[data-fixture="lane"]')).toHaveAttribute('stroke-opacity', '1');
        await expect(page.locator('.leaflet-editing-icon')).toHaveCount(0);
    });

    test('opening Groups clears existing area-selection handles before isolation starts', async ({
        page
    }) => {
        await seedIsolationMap(page);
        await page.evaluate(() =>
            (document.getElementById('app') as any).__vue_app__.config.globalProperties.$pinia._s
                .get('map')
                .map.setView([52.5, -1.9], 16)
        );
        await page.locator('#select-area-button').click();
        await dragSelectCenter(page, 200);
        const handles = page.locator('path[fill="#ffffff"][stroke="#3b82f6"]');
        await expect(handles).toHaveCount(5);
        const selectedIds = () =>
            page.evaluate(() =>
                (
                    document.getElementById('app') as any
                ).__vue_app__.config.globalProperties.$pinia._s
                    .get('selection')
                    .selected.map((entry: any) => entry.historyId)
            );
        expect(await selectedIds()).toContain('lane');
        expect(await selectedIds()).toContain('shared-cell');
        await page.locator('#map').press('g');
        await expect(handles).toHaveCount(0);
        expect(await selectedIds()).toEqual([]);
        await page.getByRole('button', { name: 'Hide group Proposal', exact: true }).click();
        await expect(handles).toHaveCount(0);
        await page.getByRole('button', { name: 'Show only group Proposal' }).click();
        await expect(handles).toHaveCount(0);
        await page.locator('[data-visibility="solo"]').click();
        await expect(handles).toHaveCount(0);
        expect(await selectedIds()).toEqual([]);
    });

    test('existing selection handles follow isolation when selection starts with Groups already open', async ({
        page
    }) => {
        await seedIsolationMap(page);
        await page.evaluate(() => {
            const map = (
                document.getElementById('app') as any
            ).__vue_app__.config.globalProperties.$pinia._s.get('map').map;
            map.setView([52.5, -1.8925], 16, { animate: false });
        });
        await openGroupsPanel(page);
        await page.locator('#select-area-button').click();
        await dragSelectCenter(page, 140, -350);
        const handles = page.locator('path[fill="#ffffff"][stroke="#3b82f6"]');
        await expect(handles).toHaveCount(5);
        const selectedIds = () =>
            page.evaluate(() =>
                (
                    document.getElementById('app') as any
                ).__vue_app__.config.globalProperties.$pinia._s
                    .get('selection')
                    .selected.map((entry: any) => entry.historyId)
            );
        const selection = await selectedIds();
        await page.getByRole('button', { name: 'Hide group Proposal', exact: true }).click();
        await expect(handles).toHaveCount(3);
        await page.getByRole('button', { name: 'Show only group Proposal' }).click();
        await expect(handles).toHaveCount(5);
        expect(await selectedIds()).toEqual(selection);
        await page.locator('[data-visibility="solo"]').click();
        await expect(handles).toHaveCount(5);
        expect(await selectedIds()).toEqual(selection);
    });
});
