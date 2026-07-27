import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import {
    addFreshStorageInitScript,
    getLayerFeatureCount,
    waitForFreshStorage
} from './indexedDbHelpers';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function setupPage(page: Page, context: BrowserContext) {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 52.5, longitude: -1.9 });
    await addFreshStorageInitScript(page);
    await page.goto('/');
    await waitForFreshStorage(page);
    await page.addStyleTag({ content: '#help { display: none !important; }' });
    await page.waitForSelector('.toolbar');
    await page.waitForFunction(() => {
        const mapEl = document.getElementById('map');
        return (
            mapEl !== null && Array.from(mapEl.classList).some((c: string) => c.startsWith('zoom-'))
        );
    });
}

async function placeModalFilter(page: Page, offsetX = 0, offsetY = 0): Promise<void> {
    await page.locator('#modal-filter-button').click();
    const map = page.locator('.leaflet-container');
    const box = await map.boundingBox();
    if (!box) throw new Error('Map bounding box not found');
    await page.mouse.click(box.x + box.width / 2 + offsetX, box.y + box.height / 2 + offsetY);
    await page.waitForTimeout(150);
}

async function dragSelectCenter(
    page: Page,
    halfSize = 80,
    offsetX = 0,
    offsetY = 0
): Promise<void> {
    const map = page.locator('.leaflet-container');
    const box = await map.boundingBox();
    if (!box) throw new Error('Map bounding box not found');
    const cx = box.x + box.width / 2 + offsetX;
    const cy = box.y + box.height / 2 + offsetY;
    await page.mouse.move(cx - halfSize, cy - halfSize);
    await page.mouse.down();
    await page.mouse.move(cx + halfSize, cy + halfSize, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(200);
}

async function placeTwoModalFilters(page: Page, offset = 70, offsetY = 0): Promise<void> {
    await page.locator('#modal-filter-button').click();
    const map = page.locator('.leaflet-container');
    const box = await map.boundingBox();
    if (!box) throw new Error('Map bounding box not found');
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2 + offsetY;
    await page.mouse.click(cx - offset, cy);
    await page.waitForTimeout(150);
    await page.mouse.click(cx + offset, cy);
    await page.waitForTimeout(150);
    await page.locator('#modal-filter-button').click();
}

async function selectBothFilters(page: Page, offsetX = 0, offsetY = 0): Promise<void> {
    await page.locator('#select-area-button').click();
    await dragSelectCenter(page, 120, offsetX, offsetY);
    await expect(page.getByText('2 features selected')).toBeVisible();
}

async function openGroupsPanel(page: Page): Promise<void> {
    await page.locator('#groups-button').click();
}

async function createGroup(page: Page, name: string): Promise<void> {
    await page.getByRole('button', { name: 'Add selected features to a group' }).click();
    await page.waitForSelector('#group-name-input');
    await page.locator('#group-name-input').fill(name);
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(300);
}

async function createGroupVersion(page: Page, name: string): Promise<void> {
    await page.getByRole('button', { name: 'Create version' }).click();
    const dialog = page.getByRole('dialog', { name: 'New Group Version' });
    await dialog.getByLabel('Version name').fill(name);
    await dialog.getByRole('button', { name: 'Create version' }).click();
    await page.waitForTimeout(300);
}

async function drawNamedLtnCell(page: Page, name: string): Promise<void> {
    await page.locator('#ltn-button').click();
    const map = page.locator('.leaflet-container');
    const box = await map.boundingBox();
    if (!box) throw new Error('Map bounding box not found');
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.waitForTimeout(200);
    await page.mouse.click(cx - 45, cy - 35);
    await page.waitForTimeout(200);
    await page.mouse.click(cx + 45, cy - 35);
    await page.waitForTimeout(200);
    await page.mouse.click(cx, cy + 35);
    await page.waitForTimeout(200);
    await page.mouse.dblclick(cx, cy + 35);
    const labelInput = page.locator('.label-editor');
    await expect(labelInput).toBeVisible();
    await labelInput.fill(name);
    await labelInput.press('Enter');
    await page.locator('#ltn-button').click();
    await page.waitForTimeout(300);
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

test.describe('Groups — Group button visibility', () => {
    test.beforeEach(async ({ page, context }) => {
        await setupPage(page, context);
    });

    test('Group button is NOT visible when fewer than 2 features are selected', async ({
        page
    }) => {
        await placeModalFilter(page);
        await page.locator('#select-area-button').click();
        await dragSelectCenter(page);
        await expect(page.getByText('1 feature selected')).toBeVisible();
        await expect(
            page.getByRole('button', { name: 'Add selected features to a group' })
        ).not.toBeVisible();
    });

    test('Group button IS visible when 2 or more features are selected', async ({ page }) => {
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await expect(
            page.getByRole('button', { name: 'Add selected features to a group' })
        ).toBeVisible();
    });
});

test.describe('Groups — Create group', () => {
    test.beforeEach(async ({ page, context }) => {
        await setupPage(page, context);
    });

    test('creating a group adds it to the Groups panel', async ({ page }) => {
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await createGroup(page, 'School Zone');

        await openGroupsPanel(page);
        await expect(page.getByRole('button', { name: /Select group School Zone/ })).toBeVisible();
    });

    test('created group shows member count', async ({ page }) => {
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await createGroup(page, 'My Group');

        await openGroupsPanel(page);
        await expect(page.locator('text=My Group')).toBeVisible();
        await expect(page.locator('text=(2)')).toBeVisible();
    });

    test('Groups panel shows empty state message when no groups', async ({ page }) => {
        await openGroupsPanel(page);
        await expect(page.getByText('No groups yet')).toBeVisible();
    });

    test('Escape key closes the Groups panel', async ({ page }) => {
        await openGroupsPanel(page);
        await expect(page.getByText('No groups yet')).toBeVisible();

        await page.keyboard.press('Escape');
        await expect(page.getByText('No groups yet')).not.toBeVisible();
    });

    test('the Groups toolbar button has a hover title', async ({ page }) => {
        await expect(page.locator('#groups-button')).toHaveAttribute('title', 'Manage groups');
    });

    test('the G key toggles the Groups popup', async ({ page }) => {
        // Ensure the map has focus context for the shortcut.
        await page.locator('#map').click();
        await page.keyboard.press('g');
        await expect(page.getByText('No groups yet')).toBeVisible();

        await page.keyboard.press('g');
        await expect(page.getByText('No groups yet')).not.toBeVisible();
    });

    test('Escape closes the keyboard-opened panel and keeps shortcuts available', async ({
        page
    }) => {
        await page.locator('#map').click();
        await page.keyboard.press('g');
        await expect(page.getByText('No groups yet')).toBeVisible();
        await page.locator('#groups-button').focus();

        await page.keyboard.press('Escape');

        await expect(page.getByText('No groups yet')).not.toBeVisible();
        await expect(page.locator('#groups-button')).toHaveAttribute('aria-pressed', 'false');
        await expect(page.locator('#groups-button')).not.toBeFocused();

        await page.keyboard.press('s');
        await expect(page.locator('#select-area-button')).toHaveAttribute('aria-pressed', 'true');
    });
});

test.describe('Groups — Rename', () => {
    test.beforeEach(async ({ page, context }) => {
        await setupPage(page, context);
    });

    test('renaming a group updates its name in the panel', async ({ page }) => {
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await createGroup(page, 'Old Name');

        await openGroupsPanel(page);
        await page.getByRole('button', { name: 'Rename group Old Name' }).click();
        await page.waitForSelector('#group-name-input');
        await page.locator('#group-name-input').fill('New Name');
        await page.getByRole('button', { name: 'Save' }).click();
        await page.waitForTimeout(300);

        await expect(page.getByRole('button', { name: /Select group New Name/ })).toBeVisible();
        await expect(page.getByRole('button', { name: /Select group Old Name/ })).not.toBeVisible();
    });
});

test.describe('Groups — Select and zoom', () => {
    test.beforeEach(async ({ page, context }) => {
        await setupPage(page, context);
    });

    test('clicking a group name selects all members and shows them as selected', async ({
        page
    }) => {
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await createGroup(page, 'Zoom Group');

        // Creating the group closes selection mode.
        await expect(page.getByText('features selected', { exact: false })).not.toBeVisible();

        // Click group name to highlight + zoom (without manually activating the
        // selection tool first).
        await openGroupsPanel(page);
        await page.getByRole('button', { name: /Select group Zoom Group/ }).click();
        await page.waitForTimeout(300);

        // Members are highlighted...
        await expect(page.locator('.leaflet-filters-pane path[stroke="#3b82f6"]')).toHaveCount(2);
        // ...but the map is NOT put into selection mode (no selection panel).
        await expect(page.getByText('features selected', { exact: false })).not.toBeVisible();
    });

    test('modifier-clicking a group member removes it from the selection', async ({ page }) => {
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await createGroup(page, 'Toggle Group');

        await openGroupsPanel(page);
        await page.getByRole('button', { name: /Select group Toggle Group/ }).click();
        await page.waitForTimeout(300);

        const selectedFilters = page.locator('.leaflet-filters-pane path[stroke="#3b82f6"]');
        await expect(selectedFilters).toHaveCount(2);

        await selectedFilters.first().dispatchEvent('click', { shiftKey: true });
        await page.waitForTimeout(200);

        await expect(selectedFilters).toHaveCount(1);
        await expect(page.getByText('1 feature selected')).toBeVisible();

        await page.getByRole('button', { name: 'Save group changes' }).click();
        await page.waitForTimeout(300);

        await openGroupsPanel(page);
        await expect(page.getByRole('button', { name: /Select group Toggle Group/ })).toContainText(
            '(1)'
        );
    });

    test('saving a group with no selected members asks whether to delete it', async ({ page }) => {
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await createGroup(page, 'Empty On Save');

        await openGroupsPanel(page);
        await page.getByRole('button', { name: /Select group Empty On Save/ }).click();
        await page.waitForTimeout(300);

        const selectedFilters = page.locator('.leaflet-filters-pane path[stroke="#3b82f6"]');
        await expect(selectedFilters).toHaveCount(2);
        await selectedFilters.first().dispatchEvent('click', { shiftKey: true });
        await page.waitForTimeout(150);
        await page
            .locator('.leaflet-filters-pane path[stroke="#3b82f6"]')
            .first()
            .dispatchEvent('click', { shiftKey: true });
        await page.waitForTimeout(200);

        await expect(page.locator('.leaflet-filters-pane path[stroke="#3b82f6"]')).toHaveCount(0);
        await expect(page.getByText('1 feature selected')).not.toBeVisible();

        await page.getByRole('button', { name: 'Save group changes' }).click();
        await expect(page.getByText('is now empty')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Delete', exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Keep empty' })).toBeVisible();
    });

    test('Escape clears all highlights after selecting a group', async ({ page }) => {
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await createGroup(page, 'Escape Group');

        await openGroupsPanel(page);
        await page.getByRole('button', { name: /Select group Escape Group/ }).click();
        await expect(page.locator('.leaflet-filters-pane path[stroke="#3b82f6"]')).toHaveCount(2);

        await page.keyboard.press('Escape');

        await expect(page.locator('.leaflet-filters-pane path[stroke="#3b82f6"]')).toHaveCount(0);
    });

    test('Escape while typing does not clear group highlights', async ({ page }) => {
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await createGroup(page, 'Typing Group');

        await openGroupsPanel(page);
        await page.getByRole('button', { name: /Select group Typing Group/ }).click();
        await expect(page.locator('.leaflet-filters-pane path[stroke="#3b82f6"]')).toHaveCount(2);

        await page.locator('#settings-button').click();
        await page.locator('#title').focus();
        await page.keyboard.press('Escape');

        await expect(page.locator('.leaflet-filters-pane path[stroke="#3b82f6"]')).toHaveCount(2);
    });

    test('switching groups clears the previous point highlights', async ({ page }) => {
        await placeTwoModalFilters(page, 70);
        await selectBothFilters(page);
        await createGroup(page, 'First Group');

        await placeTwoModalFilters(page, 70, 180);
        await selectBothFilters(page, 0, 180);
        await createGroup(page, 'Second Group');

        await openGroupsPanel(page);
        await page.getByRole('button', { name: /Select group First Group/ }).click();
        await expect(page.locator('.leaflet-filters-pane path[stroke="#3b82f6"]')).toHaveCount(2);

        await openGroupsPanel(page);
        await page.getByRole('button', { name: /Select group Second Group/ }).click();
        await expect(page.locator('.leaflet-filters-pane path[stroke="#3b82f6"]')).toHaveCount(2);
        await expect(page.locator('.leaflet-filters-pane path[stroke="green"]')).toHaveCount(2);
    });
});

test.describe('Groups — mixed member types', () => {
    test.beforeEach(async ({ page, context }) => {
        await setupPage(page, context);
    });

    test('selecting a group highlights point and polygon members, not just polylines', async ({
        page
    }) => {
        const map = page.locator('.leaflet-container');
        const box = await map.boundingBox();
        if (!box) throw new Error('no box');
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
        await selectedPoint.dispatchEvent('click', { shiftKey: true });
        await page.getByRole('button', { name: 'Save group changes' }).click();
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
            .dispatchEvent('click', { shiftKey: true });
        await expect(polygonHandles).toHaveCount(0);

        await page.getByRole('button', { name: 'Save group changes' }).click();
        await expect(page.getByText('is now empty')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Delete', exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Keep empty' })).toBeVisible();
    });
});

test.describe('Groups — add features to an existing group', () => {
    test.beforeEach(async ({ page, context }) => {
        await setupPage(page, context);
    });

    async function placeFilterAt(page: Page, offsetX: number, offsetY: number): Promise<void> {
        await page.locator('#modal-filter-button').click();
        const map = page.locator('.leaflet-container');
        const box = await map.boundingBox();
        if (!box) throw new Error('Map bounding box not found');
        await page.mouse.click(box.x + box.width / 2 + offsetX, box.y + box.height / 2 + offsetY);
        await page.waitForTimeout(150);
        await page.locator('#modal-filter-button').click();
    }

    async function dragRegion(page: Page, offsetX: number, offsetY: number): Promise<void> {
        const map = page.locator('.leaflet-container');
        const box = await map.boundingBox();
        if (!box) throw new Error('Map bounding box not found');
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

    test('group-first: the panel "Add features" button adds the next selection', async ({
        page
    }) => {
        // Create a group from two central filters.
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await createGroup(page, 'Zone');

        // Place a third filter off to the side.
        await placeFilterAt(page, 200, 0);

        // Group-first: from the panel, choose "Add features to group" (this
        // activates area selection targeting the group).
        await openGroupsPanel(page);
        await page.getByRole('button', { name: 'Add features to group Zone' }).click();
        await page.waitForTimeout(200);

        // Selecting the third filter now offers an "Add to Zone" confirmation.
        await dragRegion(page, 200, 0);
        await expect(page.getByText('1 feature selected')).toBeVisible();
        await page.getByRole('button', { name: 'Add selected features to group Zone' }).click();
        await page.waitForTimeout(300);

        await expect(page.getByText('features selected', { exact: false })).not.toBeVisible();
        await openGroupsPanel(page);
        await expect(page.getByRole('button', { name: /Select group Zone/ })).toContainText('(3)');
    });

    test('group-first: clicking a point adds it instead of deleting it', async ({ page }) => {
        // Create a group from two central filters.
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await createGroup(page, 'Zone');

        // Place a third filter off to the side.
        await placeFilterAt(page, 200, 0);
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(3);

        // Group-first: enter add mode for the group.
        await openGroupsPanel(page);
        await page.getByRole('button', { name: 'Add features to group Zone' }).click();
        await page.waitForTimeout(200);

        // Click (not drag) the third filter. It must be selected, NOT deleted.
        const map = page.locator('.leaflet-container');
        const box = await map.boundingBox();
        if (!box) throw new Error('Map bounding box not found');
        await page.mouse.click(box.x + box.width / 2 + 200, box.y + box.height / 2);
        await page.waitForTimeout(200);

        // The filter still exists (was not deleted) and is offered for adding.
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(3);
        await expect(page.getByText('1 feature selected')).toBeVisible();

        await page.getByRole('button', { name: 'Add selected features to group Zone' }).click();
        await page.waitForTimeout(300);

        await openGroupsPanel(page);
        await expect(page.getByRole('button', { name: /Select group Zone/ })).toContainText('(3)');
    });
});

test.describe('Groups — Delete group with elements', () => {
    test.beforeEach(async ({ page, context }) => {
        await setupPage(page, context);
    });

    test('deleting a group removes it and its features from the map', async ({ page }) => {
        await placeTwoModalFilters(page);
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(2);

        await selectBothFilters(page);
        await createGroup(page, 'Delete Me');

        await openGroupsPanel(page);
        await page.getByRole('button', { name: 'Delete group Delete Me' }).click();

        // Choose "delete group + elements".
        await page.getByRole('button', { name: 'Delete group + elements' }).click();
        await page.waitForTimeout(300);

        // Group should be gone.
        await expect(
            page.getByRole('button', { name: /Select group Delete Me/ })
        ).not.toBeVisible();

        // Features should be removed from the map.
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(0);
    });

    test('deleting an empty group does not ask how to handle zero members', async ({ page }) => {
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await createGroup(page, 'Empty Group');

        await openGroupsPanel(page);
        await page
            .getByRole('button', { name: 'Remove all elements from group Empty Group' })
            .click();
        await page.getByRole('button', { name: 'Keep empty' }).click();
        await page.getByRole('button', { name: 'Delete group Empty Group' }).click();

        await expect(
            page.getByRole('button', { name: /Select group Empty Group/ })
        ).not.toBeVisible();
        await expect(page.getByRole('button', { name: 'Delete group only' })).not.toBeVisible();
        await expect(
            page.getByRole('button', { name: 'Delete group + elements' })
        ).not.toBeVisible();
    });

    test('deleting a group only keeps its features on the map', async ({ page }) => {
        await placeTwoModalFilters(page);
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(2);

        await selectBothFilters(page);
        await createGroup(page, 'Keep Features');

        await openGroupsPanel(page);
        await page.getByRole('button', { name: 'Delete group Keep Features' }).click();

        // Choose "delete group only".
        await page.getByRole('button', { name: 'Delete group only' }).click();
        await page.waitForTimeout(300);

        // Group should be gone.
        await expect(
            page.getByRole('button', { name: /Select group Keep Features/ })
        ).not.toBeVisible();

        // Features should remain on the map.
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(2);
    });

    test('deleting a group only clears the selection highlight from its elements', async ({
        page
    }) => {
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await createGroup(page, 'Keep');

        // Select the group so its members are highlighted.
        await openGroupsPanel(page);
        await page.getByRole('button', { name: /Select group Keep/ }).click();
        await page.waitForTimeout(300);
        await expect(page.locator('.leaflet-filters-pane path[stroke="#3b82f6"]')).toHaveCount(2);

        // Delete the group only.
        await openGroupsPanel(page);
        await page.getByRole('button', { name: 'Delete group Keep' }).click();
        await page.getByRole('button', { name: 'Delete group only' }).click();
        await page.waitForTimeout(300);

        // Highlight is cleared, but the two filters remain on the map.
        await expect(page.locator('.leaflet-filters-pane path[stroke="#3b82f6"]')).toHaveCount(0);
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(2);
    });

    test('delete group with elements is undoable', async ({ page }) => {
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await createGroup(page, 'Undo Delete');

        await openGroupsPanel(page);
        await page.getByRole('button', { name: 'Delete group Undo Delete' }).click();
        await page.getByRole('button', { name: 'Delete group + elements' }).click();
        await page.waitForTimeout(300);

        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(0);

        // Close the Groups panel so the undo button is accessible.
        await page.getByRole('button', { name: 'Close groups panel' }).click();
        await page.waitForTimeout(100);

        // Undo.
        await page.locator('#undo-button').click();
        await page.waitForTimeout(500);

        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(2);
        // Group should be restored — re-open the panel to verify.
        await openGroupsPanel(page);
        await expect(page.getByRole('button', { name: /Select group Undo Delete/ })).toBeVisible();
    });
});

test.describe('Groups — Delete version', () => {
    test.beforeEach(async ({ page, context }) => {
        await setupPage(page, context);
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await createGroup(page, 'Versioned Group');
        await openGroupsPanel(page);
        await page.getByRole('button', { name: /Select group Versioned Group/ }).click();
        await expect(page.locator('.leaflet-filters-pane path[stroke="#3b82f6"]')).toHaveCount(2);
        await openGroupsPanel(page);
        await createGroupVersion(page, 'Alternative');
        await expect(
            page.getByLabel('Version for group Versioned Group').locator('option:checked')
        ).toHaveText('Alternative');
        await expect(page.locator('.leaflet-filters-pane path[stroke="#3b82f6"]')).toHaveCount(2);
    });

    test('deleting a version only prompts, keeps its elements, and clears highlights', async ({
        page
    }) => {
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(4);

        await page.getByRole('button', { name: 'Delete version' }).click();

        await expect(page.getByText('Delete version Alternative?')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Delete version only' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Delete version + elements' })).toBeVisible();
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(4);

        await page.getByRole('button', { name: 'Delete version only' }).click();
        await page.waitForTimeout(300);

        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(4);
        await expect(page.getByLabel('Version for group Versioned Group')).not.toBeVisible();
        await expect(page.locator('.leaflet-filters-pane path[stroke="#3b82f6"]')).toHaveCount(0);
    });

    test('deleting a version with its elements removes its features and clears highlights', async ({
        page
    }) => {
        await page.getByRole('button', { name: 'Delete version' }).click();
        await page.getByRole('button', { name: 'Delete version + elements' }).click();
        await page.waitForTimeout(300);

        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(2);
        await expect(page.getByLabel('Version for group Versioned Group')).not.toBeVisible();
        await expect(page.locator('.leaflet-filters-pane path[stroke="#3b82f6"]')).toHaveCount(0);
    });

    test('deleting an empty version does not ask how to handle zero members', async ({ page }) => {
        await page
            .getByRole('button', { name: 'Remove all elements from group Versioned Group' })
            .click();
        await page.getByRole('button', { name: 'Keep empty' }).click();
        await page.getByRole('button', { name: 'Delete version' }).click();

        await expect(page.getByLabel('Version for group Versioned Group')).not.toBeVisible();
        await expect(page.getByRole('button', { name: 'Delete version only' })).not.toBeVisible();
        await expect(
            page.getByRole('button', { name: 'Delete version + elements' })
        ).not.toBeVisible();
    });
});

test.describe('Groups — Version-specific LTN cells', () => {
    test.beforeEach(async ({ page, context }) => {
        await setupPage(page, context);
        await placeTwoModalFilters(page, 90);
        await selectBothFilters(page);
        await createGroup(page, 'Versioned LTN');
        await openGroupsPanel(page);
        await createGroupVersion(page, 'Alternative');
    });

    test('hides the cell title and excludes the cell from selection in other versions', async ({
        page
    }) => {
        await page.getByRole('button', { name: 'Close groups panel' }).click();
        await drawNamedLtnCell(page, 'New cell');
        await expect(page.getByText('New cell', { exact: true })).toBeVisible();

        await openGroupsPanel(page);
        await page.getByRole('button', { name: /Select group Versioned LTN/ }).click();
        await page
            .locator('.leaflet-ltns-pane path.ltn-cell.leaflet-interactive')
            .dispatchEvent('click', { shiftKey: true });
        await page.getByRole('button', { name: 'Save group changes' }).click();

        await openGroupsPanel(page);
        await page.getByLabel('Version for group Versioned LTN').selectOption({ label: 'Default' });
        await page.waitForTimeout(300);

        const cellPath = page.locator('.leaflet-ltns-pane path.ltn-cell.leaflet-interactive');
        await expect(cellPath).toHaveAttribute('stroke-opacity', '0');
        await expect(cellPath).toHaveAttribute('fill-opacity', '0');
        await expect(cellPath).toHaveCSS('pointer-events', 'none');
        await expect(page.getByText('New cell', { exact: true })).not.toBeVisible();

        await page.getByRole('button', { name: 'Close groups panel' }).click();
        await page.locator('#select-area-button').click();
        await dragSelectCenter(page, 55);

        const selectedLtnCount = await page.evaluate(() => {
            const app = (document.getElementById('app') as any).__vue_app__;
            const pinia = app?.config?.globalProperties?.$pinia;
            const selectionStore = pinia?._s?.get('selection');
            return (selectionStore?.selected ?? []).filter(
                (entry: any) => entry.layerId === 'LtnCells'
            ).length;
        });
        expect(selectedLtnCount).toBe(0);
    });
});

test.describe('Groups — Remove all elements', () => {
    test.beforeEach(async ({ page, context }) => {
        await setupPage(page, context);
    });

    test('removing all elements keeps features on map but empties the group', async ({ page }) => {
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await createGroup(page, 'Remove Members');

        await openGroupsPanel(page);
        await page
            .getByRole('button', { name: 'Remove all elements from group Remove Members' })
            .click();
        await page.waitForTimeout(200);

        // Features should still be on the map.
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(2);

        // Confirm panel shows the empty-group question.
        await expect(page.getByText('is now empty')).toBeVisible();
    });

    test('keeping an empty group after remove-all retains the group entry', async ({ page }) => {
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await createGroup(page, 'Keep Empty');

        await openGroupsPanel(page);
        await page
            .getByRole('button', { name: 'Remove all elements from group Keep Empty' })
            .click();
        await page.waitForTimeout(200);

        await page.getByRole('button', { name: 'Keep empty' }).click();
        await page.waitForTimeout(200);

        await expect(page.getByRole('button', { name: /Select group Keep Empty/ })).toBeVisible();
        await expect(page.locator('text=(0)')).toBeVisible();
    });

    test('deleting after remove-all removes the group entry', async ({ page }) => {
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await createGroup(page, 'Gone Group');

        await openGroupsPanel(page);
        await page
            .getByRole('button', { name: 'Remove all elements from group Gone Group' })
            .click();
        await page.waitForTimeout(200);

        await page.getByRole('button', { name: 'Delete', exact: true }).first().click();
        await page.waitForTimeout(200);

        await expect(
            page.getByRole('button', { name: /Select group Gone Group/ })
        ).not.toBeVisible();
    });
});

test.describe('Groups — Visibility', () => {
    test.beforeEach(async ({ page, context }) => {
        await setupPage(page, context);
    });

    test('toggling a group invisible hides the visibility indicator', async ({ page }) => {
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await createGroup(page, 'Visible Group');

        await openGroupsPanel(page);
        const toggleBtn = page.getByRole('button', { name: 'Hide group Visible Group' });
        await expect(toggleBtn).toBeVisible();
        await toggleBtn.click();
        await page.waitForTimeout(100);

        await expect(page.getByRole('button', { name: 'Show group Visible Group' })).toBeVisible();
    });

    test('master show-all/hide-all toggle appears when there are groups', async ({ page }) => {
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await createGroup(page, 'Group A');

        await openGroupsPanel(page);
        await expect(page.locator('#groups-master-toggle')).toBeVisible();
    });

    test('master toggle hides all groups at once', async ({ page }) => {
        // Create two groups in sequence.
        await placeTwoModalFilters(page, 40);
        await selectBothFilters(page);
        await createGroup(page, 'Group One');

        // Creating a group now closes the selection pop-up, so a single click
        // re-activates area selection for the next group.
        await page.waitForTimeout(200);
        await page.locator('#select-area-button').click(); // activate
        await dragSelectCenter(page, 120);
        await expect(page.getByText('2 features selected')).toBeVisible();
        await createGroup(page, 'Group Two');

        await openGroupsPanel(page);
        // Master toggle is unchecked by default.
        await expect(page.locator('#groups-master-toggle')).not.toBeChecked();

        // Check (hide all).
        await page.locator('#groups-master-toggle').check();
        await page.waitForTimeout(100);

        await expect(page.getByRole('button', { name: 'Show group Group One' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Show group Group Two' })).toBeVisible();
    });
});

test.describe('Groups — Multi-group membership', () => {
    test.beforeEach(async ({ page, context }) => {
        await setupPage(page, context);
    });

    test('an element can belong to more than one group', async ({ page }) => {
        await placeTwoModalFilters(page, 40);

        // Select both, create Group A.
        await selectBothFilters(page);
        await createGroup(page, 'Group A');

        // Creating a group now closes the selection pop-up, so a single click
        // re-activates area selection for the next group.
        await page.waitForTimeout(200);
        await page.locator('#select-area-button').click(); // activate
        await dragSelectCenter(page, 120);
        await expect(page.getByText('2 features selected')).toBeVisible();
        await createGroup(page, 'Group B');

        await openGroupsPanel(page);
        await expect(page.getByRole('button', { name: /Select group Group A/ })).toBeVisible();
        await expect(page.getByRole('button', { name: /Select group Group B/ })).toBeVisible();
        // Both groups have 2 members.
        await expect(page.locator('text=(2)').first()).toBeVisible();
    });
});

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
