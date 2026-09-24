import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { getLayerFeatureCount } from '../indexedDbHelpers';
import {
    setupPage,
    placeTwoModalFilters,
    selectBothFilters,
    openGroupsPanel,
    openGroupDetails,
    createGroup
} from './groupTestHelpers';

test.describe('Groups — add features to an existing group', () => {
    test.beforeEach(async ({ page, context }) => {
        await setupPage(page, context);
    });

    async function placeFilterAt(page: Page, offsetX: number, offsetY: number): Promise<void> {
        await page.locator('#modal-filter-button').click();
        const map = page.locator('.leaflet-container');
        const box = await map.boundingBox();
        if (!box) {
            throw new Error('Map bounding box not found');
        }
        await page.mouse.click(box.x + box.width / 2 + offsetX, box.y + box.height / 2 + offsetY);
        await page.waitForTimeout(150);
        await page.locator('#modal-filter-button').click();
    }

    async function dragRegion(page: Page, offsetX: number, offsetY: number): Promise<void> {
        const map = page.locator('.leaflet-container');
        const box = await map.boundingBox();
        if (!box) {
            throw new Error('Map bounding box not found');
        }
        const cx = box.x + box.width / 2 + offsetX;
        const cy = box.y + box.height / 2 + offsetY;
        await page.mouse.move(cx - 40, cy - 40);
        await page.mouse.down();
        await page.mouse.move(cx + 40, cy + 40, { steps: 8 });
        await page.mouse.up();
        await page.waitForTimeout(200);
    }

    test('selection-first: the toolbar dropdown adds the selection to a group', async ({
        page
    }) => {
        // Create a group from two central filters.
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await createGroup(page, 'Zone');

        // Place a third filter off to the side.
        await placeFilterAt(page, 200, 0);

        // Select just the third filter, then add it to the group via the dropdown.
        await page.locator('#select-area-button').click();
        await dragRegion(page, 200, 0);
        await expect(page.getByText('1 feature selected')).toBeVisible();
        await page
            .getByLabel('Add selected features to an existing group')
            .selectOption({ label: 'Zone' });
        await page.waitForTimeout(300);

        // Group now has 3 members and selection mode has closed.
        await expect(page.getByText('features selected', { exact: false })).not.toBeVisible();
        await openGroupsPanel(page);
        await expect(page.getByRole('button', { name: /Select group Zone/ })).toContainText('(3)');
    });

    test('group editor adds a clicked feature without deleting it', async ({ page }) => {
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await createGroup(page, 'Zone');
        await placeFilterAt(page, 200, 0);
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(3);

        await openGroupsPanel(page);
        await openGroupDetails(page, 'Zone');
        const marker = page.locator('.leaflet-filters-pane path.modal-filter-marker').last();
        await marker.dispatchEvent('click');
        await page.waitForTimeout(200);

        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(3);
        await expect(
            page.getByRole('dialog', { name: 'Group details' }).getByText('(3 features)', {
                exact: true
            })
        ).toBeVisible();
    });
});
