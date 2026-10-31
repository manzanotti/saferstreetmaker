import { test, expect } from '@playwright/test';
import { addFreshStorageInitScript, waitForFreshStorage } from './indexedDbHelpers';

test.describe('Settings Panel', () => {
    test.beforeEach(async ({ page }) => {
        await addFreshStorageInitScript(page);
        await page.goto('/');
        await waitForFreshStorage(page);
        await page.waitForSelector('.toolbar');
    });

    test('undo and redo restore a saved title change', async ({ page }) => {
        await page.locator('#settings-button').click();
        await page.locator('#title').fill('Saved Title');
        await page.locator('button:has-text("Save")').click();

        await expect(page.locator('#undo-button')).toBeEnabled();
        await expect(page.locator('#redo-button')).toBeDisabled();

        await page.locator('#undo-button').click();
        await page.waitForTimeout(150);

        await page.locator('#settings-button').click();
        await expect(page.locator('#title')).toHaveValue('Hello Cleveland');
        await page.getByRole('button', { name: 'Close settings panel' }).click();

        await expect(page.locator('#redo-button')).toBeEnabled();
        await page.locator('#redo-button').click();
        await page.waitForTimeout(150);

        await page.locator('#settings-button').click();
        await expect(page.locator('#title')).toHaveValue('Saved Title');
    });

    test('undo and redo buttons are disabled on a fresh map with no edits', async ({ page }) => {
        await expect(page.locator('#undo-button')).toBeDisabled();
        await expect(page.locator('#redo-button')).toBeDisabled();
    });

    test('creating a new map resets the undo history', async ({ page }) => {
        // Make an edit so there is something to undo.
        await page.locator('#settings-button').click();
        await page.locator('#title').fill('Map With History');
        await page.locator('button:has-text("Save")').click();
        await expect(page.locator('#undo-button')).toBeEnabled();

        // Create a new map — this should reset history.
        await page.locator('#map-manager-button').click();
        await page.locator('#new-map').click();
        await page.locator('#new-map-title').fill('Brand New Map');
        await page.locator('#create-new-map button').click();
        await page.waitForTimeout(300);

        await expect(page.locator('#undo-button')).toBeDisabled();
        await expect(page.locator('#redo-button')).toBeDisabled();
        await page.locator('#layers-button').click();
        await expect(page.getByLabel('Open layer Birmingham Wards')).toBeVisible();
        await expect(page.getByLabel('Show layer Birmingham Wards')).toBeVisible();
    });

    test('new maps retain disabled Bus Lanes through undo and redo', async ({ page }) => {
        await page.locator('#map-manager-button').click();
        await page.locator('#new-map').click();
        await page.locator('#new-map-title').fill('Versioned New Map');
        await page.locator('#create-new-map button').click();
        await page.waitForTimeout(300);

        await page.locator('#settings-button').click();
        await page.locator('#BusLanes').uncheck();
        await page.locator('button:has-text("Save")').click();
        await expect(page.locator('#bus-lane-button')).not.toBeVisible();
        await expect(page.locator('#tram-line-button')).toBeVisible();

        await page.locator('#undo-button').click();
        await page.waitForTimeout(150);
        await page.locator('#settings-button').click();
        await expect(page.locator('#BusLanes')).toBeChecked();
        await page.getByRole('button', { name: 'Close settings panel' }).click();

        await page.locator('#redo-button').click();
        await page.waitForTimeout(150);
        await page.locator('#settings-button').click();
        await expect(page.locator('#BusLanes')).not.toBeChecked();
        await page.getByRole('button', { name: 'Close settings panel' }).click();
    });

    test('switching stored maps restores the correct independent undo state', async ({
        page,
        context
    }) => {
        // Make an edit on the first map.
        await page.locator('#settings-button').click();
        await page.locator('#title').fill('First Map');
        await page.locator('button:has-text("Save")').click();
        await expect(page.locator('#undo-button')).toBeEnabled();

        // Create a second map and verify it starts with no history.
        await page.locator('#map-manager-button').click();
        await page.locator('#new-map').click();
        await page.locator('#new-map-title').fill('Second Map');
        await page.locator('#create-new-map button').click();
        await page.waitForTimeout(300);
        await expect(page.locator('#undo-button')).toBeDisabled();

        await page.locator('#settings-button').click();
        await expect(page.locator('#title')).toHaveValue('Second Map');
        await page.getByRole('button', { name: 'Close settings panel' }).click();

        // Switch back to the first map and verify its history is still available.
        // The map name is rendered as a <span> inside the <li> — click the span.
        await page.locator('#map-manager-button').click();
        await page
            .locator('#map-list span.cursor-pointer')
            .filter({ hasText: 'First Map' })
            .click();
        await page.waitForTimeout(300);
        await expect(page.locator('#undo-button')).toBeEnabled();

        // Prove this is the first map's history, not just any enabled undo state.
        await page.locator('#undo-button').click();
        await page.waitForTimeout(200);

        await page.locator('#settings-button').click();
        await expect(page.locator('#title')).toHaveValue('Hello Cleveland');
        await page.getByRole('button', { name: 'Close settings panel' }).click();

        await expect(page.locator('#redo-button')).toBeEnabled();
    });
});
