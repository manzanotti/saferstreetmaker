import { test, expect } from '@playwright/test';
import { setupPage, openGroupsPanel, createGroup } from './groupTestHelpers';

test.describe('Groups — mixed member types', () => {
    test.beforeEach(async ({ page, context }) => {
        await setupPage(page, context);
    });

    test('selecting a group highlights point and polygon members, not just polylines', async ({
        page
    }) => {
        const map = page.locator('.leaflet-container');
        const box = await map.boundingBox();
        if (!box) {
            throw new Error('no box');
        }
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;

        // Draw an LTN polygon.
        await page.locator('#ltn-button').click();
        await page.waitForTimeout(200);
        await page.mouse.click(cx - 40, cy - 40);
        await page.waitForTimeout(200);
        await page.mouse.click(cx + 40, cy - 40);
        await page.waitForTimeout(200);
        await page.mouse.click(cx, cy + 40);
        await page.waitForTimeout(200);
        await page.mouse.dblclick(cx, cy + 40);
        await page.waitForTimeout(500);
        await page.locator('#ltn-button').click();

        // Place a modal filter to the side.
        await page.locator('#modal-filter-button').click();
        await page.mouse.click(cx + 120, cy);
        await page.waitForTimeout(150);
        await page.locator('#modal-filter-button').click();

        // Area-select over both, then group them.
        await page.locator('#select-area-button').click();
        await page.mouse.move(cx - 100, cy - 100);
        await page.mouse.down();
        await page.mouse.move(cx + 160, cy + 100, { steps: 10 });
        await page.mouse.up();
        await page.waitForTimeout(200);
        await expect(page.getByText('2 features selected')).toBeVisible();

        await createGroup(page, 'Mixed');

        // The group must retain BOTH members (the LTN polygon must not be
        // pruned as dangling because its id lives on properties.historyId).
        const memberCount = await page.evaluate(() => {
            const app = (document.getElementById('app') as any).__vue_app__;
            const pinia = app?.config?.globalProperties?.$pinia;
            const groupStore = pinia?._s?.get('group');
            return (groupStore?.groups ?? []).flatMap((g: any) => g.members).length;
        });
        expect(memberCount).toBe(2);

        // Select the group; both the point and the polygon must be highlighted.
        await openGroupsPanel(page);
        await page.getByRole('button', { name: /Select group Mixed/ }).click();
        await page.waitForTimeout(300);

        // Polygon vertex handles (blue circle markers) appear in the overlay pane.
        await expect(
            page.locator('.leaflet-overlay-pane path[stroke="#3b82f6"]').first()
        ).toBeVisible();
        // Point marker is highlighted in the filters pane.
        const selectedPoint = page.locator('.leaflet-filters-pane path[stroke="#3b82f6"]');
        await expect(selectedPoint).toHaveCount(1);
        await expect(
            page.getByRole('button', { name: 'Delete selected features' })
        ).not.toBeVisible();

        // Remove the point so the polygon is the group's only remaining feature.
        await selectedPoint.dispatchEvent('click');
        await page.getByRole('button', { name: 'Close group details' }).click();
        await page.waitForTimeout(300);

        await openGroupsPanel(page);
        const groupButton = page.getByRole('button', { name: /Select group Mixed/ });
        await expect(groupButton).toContainText('(1)');
        await groupButton.click();
        await page.waitForTimeout(300);

        const polygonHandles = page.locator('.leaflet-overlay-pane path[stroke="#3b82f6"]');
        await expect(polygonHandles.first()).toBeVisible();
        await page
            .locator('.leaflet-ltns-pane path.ltn-cell.leaflet-interactive')
            .first()
            .dispatchEvent('click');
        await expect(polygonHandles).toHaveCount(0);
    });
});
