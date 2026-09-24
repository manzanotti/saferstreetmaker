import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { setupPage, placeModalFilter, openGroupsPanel } from './groupTestHelpers';

test.describe('Groups — Partial polyline split', () => {
    test.beforeEach(async ({ page, context }) => {
        await setupPage(page, context);
    });

    /**
     * Draw a 3-vertex mobility lane, place a modal filter near the left vertex,
     * then drag-select to capture BOTH the filter AND the left polyline vertex.
     * This produces featureCount=2 with a partially-selected polyline.
     */
    async function setupPartialPolylineSelection(page: Page): Promise<void> {
        await page.locator('#mobility-lane-button').click();
        const map = page.locator('.leaflet-container');
        const box = await map.boundingBox();
        if (!box) throw new Error('Map bounding box not found');
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        // 3 vertices: (cx-60,cy), (cx,cy), (cx+60,cy)
        await page.waitForTimeout(200);
        await page.mouse.click(cx - 60, cy);
        await page.waitForTimeout(200);
        await page.mouse.click(cx, cy);
        await page.waitForTimeout(200);
        await page.mouse.dblclick(cx + 60, cy);
        await page.waitForTimeout(500);
        await page.locator('#mobility-lane-button').click();

        // Place modal filter near the left vertex: cx-60, cy+40
        await placeModalFilter(page, -60, 40);

        // Drag-select: capture (cx-60,cy) vertex and (cx-60,cy+40) filter
        await page.locator('#select-area-button').click();
        await page.mouse.move(cx - 90, cy - 20);
        await page.mouse.down();
        await page.mouse.move(cx - 30, cy + 60, { steps: 10 });
        await page.mouse.up();
        await page.waitForTimeout(200);
    }

    test('grouping a partially-selected polyline shows the split dialog', async ({ page }) => {
        await setupPartialPolylineSelection(page);

        await expect(page.getByText('2 features selected')).toBeVisible();
        await page.getByRole('button', { name: 'Add selected features to a group' }).click();
        await page.waitForTimeout(200);

        await expect(page.locator('#partial-polyline-dialog-title')).toBeVisible();
        await expect(page.getByText('Partially Selected Lines')).toBeVisible();
        await expect(
            page
                .getByRole('dialog', { name: 'Partially Selected Lines' })
                .getByText('Mobility Lanes')
        ).toBeVisible();
    });

    test('accepting the split creates a new polyline and proceeds to name dialog', async ({
        page
    }) => {
        await setupPartialPolylineSelection(page);

        await page.getByRole('button', { name: 'Add selected features to a group' }).click();
        await page.waitForTimeout(200);

        await page.getByRole('button', { name: 'Yes, split them' }).click();
        await page.waitForTimeout(200);

        await expect(page.locator('#group-name-input')).toBeVisible();
    });

    test('skipping the split opens the name dialog without splitting', async ({ page }) => {
        await setupPartialPolylineSelection(page);

        await page.getByRole('button', { name: 'Add selected features to a group' }).click();
        await page.waitForTimeout(200);

        await page.getByRole('button', { name: 'No, skip them' }).click();
        await page.waitForTimeout(200);

        await expect(page.locator('#group-name-input')).toBeVisible();
    });

    test('accepting the split then cancelling the name dialog creates no group', async ({
        page
    }) => {
        await setupPartialPolylineSelection(page);

        await page.getByRole('button', { name: 'Add selected features to a group' }).click();
        await page.waitForTimeout(200);
        await page.getByRole('button', { name: 'Yes, split them' }).click();
        await page.waitForTimeout(200);

        // Cancel the name dialog.
        await page
            .getByRole('dialog', { name: 'New Group' })
            .getByRole('button', { name: 'Cancel' })
            .click();
        await page.waitForTimeout(200);

        // No group should have been created.
        await openGroupsPanel(page);
        await expect(page.getByText('No groups yet')).toBeVisible();
    });
});
