import { test, expect } from '@playwright/test';
import { Buffer } from 'node:buffer';
import {
    addFreshStorageInitScript,
    getLayerFeatureCount,
    seedStoredMap,
    waitForFreshStorage
} from './indexedDbHelpers';

test.describe('Settings Panel', () => {
    test.beforeEach(async ({ page }) => {
        await addFreshStorageInitScript(page);
        await page.goto('/');
        await waitForFreshStorage(page);
        await page.waitForSelector('.toolbar');
    });

    test('settings panel is not visible on load', async ({ page }) => {
        // The settings panel contains a unique #read-only checkbox
        await expect(page.locator('#read-only')).not.toBeAttached();
    });

    test('clicking settings button opens the settings panel', async ({ page }) => {
        await page.locator('#settings-button').click();
        await expect(page.locator('#read-only')).toBeVisible();
    });

    test('clicking settings button a second time closes the settings panel', async ({ page }) => {
        const settingsButton = page.locator('#settings-button');
        await settingsButton.click(); // open
        await expect(page.locator('#read-only')).toBeVisible();
        await settingsButton.click(); // close
        await expect(page.locator('#read-only')).not.toBeAttached();
    });

    test('clicking the settings Save button saves and closes the panel', async ({ page }) => {
        await page.locator('#settings-button').click();
        await page.locator('#title').fill('Saved Title');
        await page.locator('button:has-text("Save")').click();
        await expect(page.locator('#read-only')).not.toBeAttached();
        await expect(page.locator('#settings-button')).toBeVisible();
    });

    test('clicking the settings Cancel button closes the panel', async ({ page }) => {
        await page.locator('#settings-button').click();
        await page.locator('button:has-text("Cancel")').click();
        await expect(page.locator('#read-only')).not.toBeAttached();
    });

    test('double-clicking a panel control does not zoom the map', async ({ page }) => {
        await page.locator('#settings-button').click();
        await expect(page.getByText('Visible Layers')).toBeVisible();

        const map = page.locator('#map');
        const initialZoom = await map.evaluate(
            (element) =>
                Array.from(element.classList).find((className) => className.startsWith('zoom-')) ??
                ''
        );

        await page.locator('button:has-text("Cancel")').dblclick();

        await page.waitForTimeout(200);

        const zoomAfter = await map.evaluate(
            (element) =>
                Array.from(element.classList).find((className) => className.startsWith('zoom-')) ??
                ''
        );

        expect(zoomAfter).toBe(initialZoom);
    });

    test('layer toggle switches are aligned to the right of their labels', async ({ page }) => {
        await page.locator('#settings-button').click();

        const label = page.locator('label[for="ModalFilters"]');
        const toggle = page.locator('#ModalFilters');
        const labelBox = await label.boundingBox();
        const toggleBox = await toggle.boundingBox();

        expect(labelBox).not.toBeNull();
        expect(toggleBox).not.toBeNull();

        if (labelBox && toggleBox) {
            expect(toggleBox.x).toBeGreaterThan(labelBox.x + labelBox.width);
        }
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
        await page.locator('button:has-text("Cancel")').click();

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
        await page.locator('button:has-text("Cancel")').click();

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
        await page.locator('button:has-text("Cancel")').click();

        await expect(page.locator('#redo-button')).toBeEnabled();
    });
});

test.describe('Map Manager Panel', () => {
    test.beforeEach(async ({ page }) => {
        await addFreshStorageInitScript(page);
        await page.goto('/');
        await waitForFreshStorage(page);
        await page.waitForSelector('.toolbar');
    });

    test('map manager panel is not visible on load', async ({ page }) => {
        await expect(page.locator('#map-manager')).not.toBeAttached();
    });

    test('clicking map manager button opens the panel', async ({ page }) => {
        await page.locator('#map-manager-button').click();
        await expect(page.locator('#map-manager')).toBeVisible();
    });

    test('loading a JSON file replaces the map and persists the uploaded data', async ({
        page
    }) => {
        const uploadedMap = {
            settings: {
                title: 'Uploaded Test Map',
                readOnly: false,
                hideToolbar: false,
                activeLayers: ['BusGates'],
                centre: { lat: 52.5, lng: -1.9 },
                zoom: 12,
                version: '0.9.0'
            },
            layers: {
                BusGates: {
                    type: 'FeatureCollection',
                    features: [
                        {
                            type: 'Feature',
                            properties: {},
                            geometry: {
                                type: 'Point',
                                coordinates: [-1.9, 52.5]
                            }
                        }
                    ]
                }
            }
        };

        await page.locator('#map-manager-button').click();
        await page.locator('#load-file').click();

        const fileInput = page.locator('input[type="file"]');
        await expect(fileInput).toBeAttached();
        await fileInput.setInputFiles({
            name: 'uploaded-test-map.json',
            mimeType: 'application/json',
            buffer: Buffer.from(JSON.stringify(uploadedMap))
        });

        await expect(page.locator('#map-manager')).not.toBeAttached();
        await expect(page.locator('.leaflet-marker-icon.bus-gate-icon')).toHaveCount(1);
        await expect
            .poll(() => getLayerFeatureCount(page, 'Uploaded Test Map', 'BusGates'))
            .toBe(1);
    });

    test('clicking map manager button a second time closes the panel', async ({ page }) => {
        const button = page.locator('#map-manager-button');
        await button.click(); // open
        await expect(page.locator('#map-manager')).toBeVisible();
        await button.click(); // close
        await expect(page.locator('#map-manager')).not.toBeAttached();
    });

    test('clicking the new map control reveals the create-map form', async ({ page }) => {
        await page.locator('#map-manager-button').click();
        await page.locator('#new-map').click();
        await expect(page.locator('#create-new-map')).toBeVisible();
    });

    test('clicking the copy map control creates another stored map entry', async ({ page }) => {
        await seedStoredMap(page, 'Hello Cleveland');

        await page.locator('#map-manager-button').click();
        await page.locator('#copy-map').click();

        await expect(page.locator('#map-list li')).toHaveCount(2);
    });

    test('clicking create in the new map form shows the duplicate-title error for existing names', async ({
        page
    }) => {
        await seedStoredMap(page, 'Hello Cleveland');

        await page.locator('#map-manager-button').click();
        await page.locator('#new-map').click();
        await page.locator('#new-map-title').fill('Hello Cleveland');
        await page.locator('#create-new-map button').click();

        await expect(page.locator('#duplicate-title-error')).toContainText(
            'You already have a map named Hello Cleveland'
        );
    });
});

test.describe('Sharing Panel', () => {
    test.beforeEach(async ({ page }) => {
        await addFreshStorageInitScript(page);
        await page.goto('/');
        await waitForFreshStorage(page);
        await page.waitForSelector('.toolbar');
    });

    test('sharing panel is not visible on load', async ({ page }) => {
        await expect(page.locator('#sharing')).not.toBeAttached();
    });

    test('clicking share button opens the sharing panel', async ({ page }) => {
        await page.locator('#share-button').click();
        await expect(page.locator('#sharing')).toBeVisible();
    });

    test('sharing panel defaults to the displayed map dimensions', async ({ page }) => {
        const mapBox = await page.locator('#map').boundingBox();
        expect(mapBox).not.toBeNull();

        await page.locator('#share-button').click();
        await expect(page.locator('#sharing')).toBeVisible();

        if (mapBox) {
            await expect(page.locator('#width')).toHaveValue(String(Math.round(mapBox.width)));
            await expect(page.locator('#height')).toHaveValue(String(Math.round(mapBox.height)));
        }
    });

    test('clicking share button a second time closes the sharing panel', async ({ page }) => {
        const button = page.locator('#share-button');
        await button.click(); // open
        await expect(page.locator('#sharing')).toBeVisible();
        await button.click(); // close
        await expect(page.locator('#sharing')).not.toBeAttached();
    });

    test('share toggle stays inside the sharing panel bounds', async ({ page }) => {
        await page.locator('#share-button').click();

        const toggleBox = await page.locator('#hide-toolbar').boundingBox();
        const panelBox = await page.locator('#sharing').boundingBox();

        expect(toggleBox).not.toBeNull();
        expect(panelBox).not.toBeNull();

        if (toggleBox && panelBox) {
            expect(toggleBox.x).toBeGreaterThanOrEqual(panelBox.x);
            expect(toggleBox.x + toggleBox.width).toBeLessThanOrEqual(panelBox.x + panelBox.width);
            expect(toggleBox.y).toBeGreaterThanOrEqual(panelBox.y);
            expect(toggleBox.y + toggleBox.height).toBeLessThanOrEqual(
                panelBox.y + panelBox.height
            );
        }
    });

    test('clicking the share Create button shows the copied-message path', async ({ page }) => {
        await page.addInitScript(() => {
            (window as any).__clipboardText = '';
            Object.defineProperty(navigator, 'clipboard', {
                value: {
                    writeText: (text: string) => (
                        ((window as any).__clipboardText = text),
                        Promise.resolve()
                    )
                },
                configurable: true
            });
        });
        await page.goto('/');
        await waitForFreshStorage(page);
        await page.waitForSelector('.toolbar');

        await page.locator('#share-button').click();
        await page.locator('#width').fill('320');
        await page.locator('#height').fill('240');
        await page.locator('button:has-text("Create")').click();

        await expect(page.locator('#messageRow')).toBeVisible();
        await expect(page.evaluate(() => (window as any).__clipboardText)).resolves.toContain(
            'iframe'
        );
    });

    test('shared group URLs select the active version in read-only mode', async ({ page }) => {
        await page.addInitScript(() => {
            (window as any).__clipboardText = '';
            Object.defineProperty(navigator, 'clipboard', {
                value: {
                    writeText: (text: string) => (
                        ((window as any).__clipboardText = text),
                        Promise.resolve()
                    )
                },
                configurable: true
            });
        });
        await page.goto('/');
        await waitForFreshStorage(page);
        await page.waitForSelector('.toolbar');
        await page.evaluate(() => {
            const app = (document.getElementById('app') as any).__vue_app__;
            const pinia = app.config.globalProperties.$pinia;
            const groupStore = pinia._s.get('group');
            const selectionStore = pinia._s.get('selection');
            groupStore.addGroup({
                id: 'shared-group',
                name: 'Shared Group',
                description: 'A shared group',
                defaultVersionId: 'version-2',
                versions: [
                    { id: 'version-1', name: 'First', members: [] },
                    { id: 'version-2', name: 'Second', members: [] }
                ],
                members: []
            });
            selectionStore.markGroupSelection('shared-group');
        });

        await page.locator('#share-button').click();
        await page.locator('#width').fill('320');
        await page.locator('#height').fill('240');
        await page.locator('button:has-text("Create")').click();
        const iframeUrl = await page.evaluate(() => {
            const src = (window as any).__clipboardText.match(/src="([^"]+)"/)?.[1];
            return src;
        });
        expect(iframeUrl).toContain('group=Shared+Group');
        expect(iframeUrl).toContain('version=2');

        await page.goto(iframeUrl);
        await expect(page.getByRole('dialog', { name: 'Shared Group' })).toBeVisible();
        await expect(page.locator('#groups-button')).not.toBeAttached();
    });

    test('clicking the share Close button closes the sharing panel', async ({ page }) => {
        await page.locator('#share-button').click();
        await page.locator('#sharing button:has-text("Close")').click();
        await expect(page.locator('#sharing')).not.toBeAttached();
    });
});
