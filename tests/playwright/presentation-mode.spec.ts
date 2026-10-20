import { test, expect, type Page } from '@playwright/test';
import {
    addFirstNavigationStorageResetScript,
    getLayerFeatureCount,
    waitForFreshStorage
} from './indexedDbHelpers';

async function savedPresentationMode(page: Page) {
    return page.evaluate(
        () =>
            new Promise<number | undefined>((resolve, reject) => {
                const open = indexedDB.open('SaferStreetMakerDB');
                open.onerror = () => reject(open.error);
                open.onsuccess = () => {
                    const db = open.result;
                    const request = db.transaction('maps').objectStore('maps').getAll();
                    request.onsuccess = () => {
                        db.close();
                        resolve(request.result[0]?.payload?.s?.r);
                    };
                    request.onerror = () => {
                        db.close();
                        reject(request.error);
                    };
                };
            })
    );
}

test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 52.5, longitude: -1.9 });
    await addFirstNavigationStorageResetScript(page);
    await page.goto('/');
    await waitForFreshStorage(page);
    await page.waitForFunction(() =>
        Array.from(document.getElementById('map')?.classList ?? []).some((name) =>
            name.startsWith('zoom-')
        )
    );
});

test('P stops drawing, persists Presentation mode, and restores editing after reload', async ({
    page
}) => {
    await page.locator('#modal-filter-button').click();
    await page.locator('#map').click({ position: { x: 450, y: 400 } });
    await expect.poll(() => getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(1);
    await page.keyboard.press('Escape');
    await page.locator('#mobility-lane-button').click();
    await page.waitForTimeout(200);
    await page.locator('#map').click({ position: { x: 400, y: 350 } });
    await expect(page.locator('.leaflet-editing-icon')).toHaveCount(1);
    await page.keyboard.press('p');
    await expect(page.locator('#mobility-lane-button')).not.toBeVisible();
    await expect(page.locator('.leaflet-draw-tooltip')).not.toBeAttached();
    await expect(page.locator('.leaflet-editing-icon')).toHaveCount(0);
    await expect.poll(() => savedPresentationMode(page)).toBe(1);

    await page.locator('#map').click({ position: { x: 500, y: 450 } });
    await page.keyboard.press('s');
    await page.keyboard.press('Control+z');
    await expect.poll(() => getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(1);
    await expect(page.locator('#select-area-button')).not.toBeVisible();

    await page.reload();
    await expect(page.locator('#settings-button')).toBeVisible();
    await expect(page.locator('#modal-filter-button')).not.toBeVisible();
    await page.locator('#settings-button').click();
    await expect(page.getByRole('switch', { name: 'Presentation mode' })).toBeChecked();
    await page.getByRole('button', { name: 'Close settings panel' }).click();
    await page.locator('#map').focus();
    await page.keyboard.press('Shift+p');
    await expect(page.locator('#modal-filter-button')).toBeVisible();
    await expect.poll(() => savedPresentationMode(page)).toBe(0);
    await page.locator('#modal-filter-button').click();
    await page.locator('#map').click({ position: { x: 550, y: 400 } });
    await expect.poll(() => getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(2);
});

test('P does not toggle while editing Settings or using a toolbar control', async ({ page }) => {
    await page.locator('#settings-button').click();
    await page.locator('#title').fill('A map with P in its name');
    await page.locator('#title').press('p');
    await expect(page.getByRole('switch', { name: 'Presentation mode' })).not.toBeChecked();
    await page.getByRole('button', { name: 'Close settings panel' }).click();
    await page.locator('#help-button').focus();
    await page.keyboard.press('p');
    await expect(page.locator('#modal-filter-button')).toBeVisible();
    await page.locator('#map').focus();
    await page.keyboard.press('p');
    await expect(page.locator('#modal-filter-button')).not.toBeVisible();
});
