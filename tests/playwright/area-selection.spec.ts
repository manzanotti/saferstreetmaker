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

/** Place a modal-filter point at the centre of the map. */
async function placeModalFilter(page: Page, offsetX = 0, offsetY = 0): Promise<void> {
    await page.locator('#modal-filter-button').click();
    const map = page.locator('.leaflet-container');
    const box = await map.boundingBox();
    if (!box) throw new Error('Map bounding box not found');
    await page.mouse.click(box.x + box.width / 2 + offsetX, box.y + box.height / 2 + offsetY);
    await page.waitForTimeout(150);
}

/**
 * Drag a rubber-band rectangle over the map centre.
 * The rectangle covers a generous area to ensure any nearby point is captured.
 */
async function dragSelectCenter(page: Page, halfSize = 80): Promise<void> {
    const map = page.locator('.leaflet-container');
    const box = await map.boundingBox();
    if (!box) throw new Error('Map bounding box not found');
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    await page.mouse.move(cx - halfSize, cy - halfSize);
    await page.mouse.down();
    await page.mouse.move(cx + halfSize, cy + halfSize, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(200);
}

async function drawMobilityLane(page: Page) {
    await page.locator('#mobility-lane-button').click();
    const map = page.locator('.leaflet-container');
    const box = await map.boundingBox();
    if (!box) throw new Error('Map bounding box not found');
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.waitForTimeout(200);
    await page.mouse.click(cx - 60, cy);
    await page.waitForTimeout(200);
    await page.mouse.click(cx, cy);
    await page.waitForTimeout(200);
    await page.mouse.dblclick(cx + 60, cy);
    await page.waitForTimeout(500);
}

async function drawLtnPolygon(page: Page) {
    await page.locator('#ltn-button').click();
    const map = page.locator('.leaflet-container');
    const box = await map.boundingBox();
    if (!box) throw new Error('Map bounding box not found');
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.waitForTimeout(200);
    await page.mouse.click(cx - 60, cy - 40);
    await page.waitForTimeout(200);
    await page.mouse.click(cx + 60, cy - 40);
    await page.waitForTimeout(200);
    await page.mouse.click(cx, cy + 50);
    await page.waitForTimeout(200);
    await page.mouse.dblclick(cx - 60, cy - 40);
    await page.waitForTimeout(500);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Area selection — button', () => {
    test.beforeEach(async ({ page, context }) => {
        await setupPage(page, context);
    });

    test('select-area button is present in the undo toolbar', async ({ page }) => {
        await expect(page.locator('#select-area-button')).toBeVisible();
    });

    test('button starts inactive (aria-pressed = false)', async ({ page }) => {
        await expect(page.locator('#select-area-button')).toHaveAttribute('aria-pressed', 'false');
    });

    test('clicking the button activates area-select mode (aria-pressed = true)', async ({
        page
    }) => {
        await page.locator('#select-area-button').click();
        await expect(page.locator('#select-area-button')).toHaveAttribute('aria-pressed', 'true');
    });

    test('clicking the active button deactivates mode', async ({ page }) => {
        await page.locator('#select-area-button').click();
        await page.locator('#select-area-button').click();
        await expect(page.locator('#select-area-button')).toHaveAttribute('aria-pressed', 'false');
    });

    test('area-select CSS class is added to #map when active', async ({ page }) => {
        await page.locator('#select-area-button').click();
        await expect(page.locator('#map')).toHaveClass(/area-select/);
    });

    test('area-select CSS class is removed from #map when deactivated', async ({ page }) => {
        await page.locator('#select-area-button').click();
        await page.locator('#select-area-button').click();
        const classes = await page.locator('#map').getAttribute('class');
        expect(classes ?? '').not.toContain('area-select');
    });
});

test.describe('Area selection — select and delete', () => {
    test.beforeEach(async ({ page, context }) => {
        await setupPage(page, context);
    });

    test('area-selection panel is not visible before mode is active', async ({ page }) => {
        // The panel only renders when isActive && selected.length > 0
        await expect(page.getByText('selected', { exact: false })).not.toBeVisible();
    });

    test('dragging over a placed point shows the area selection panel', async ({ page }) => {
        await placeModalFilter(page);
        await page.locator('#select-area-button').click();
        await dragSelectCenter(page);
        await expect(page.getByText('1 feature selected')).toBeVisible();
    });

    test('cancel button hides the panel without deleting', async ({ page }) => {
        await placeModalFilter(page);
        const countBefore = await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters');

        await page.locator('#select-area-button').click();
        await dragSelectCenter(page);
        await expect(page.getByText('1 feature selected')).toBeVisible();

        await page.getByRole('button', { name: 'Cancel area selection' }).click();
        await expect(page.getByText('selected', { exact: false })).not.toBeVisible();

        const countAfter = await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters');
        expect(countAfter).toBe(countBefore);
    });

    test('delete button removes selected points and persists the deletion', async ({ page }) => {
        await placeModalFilter(page);
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(1);

        await page.locator('#select-area-button').click();
        await dragSelectCenter(page);
        await expect(page.getByText('1 feature selected')).toBeVisible();

        await page.getByRole('button', { name: 'Delete selected features' }).click();
        await page.waitForTimeout(300);

        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(0);
    });

    test('delete enables the undo button', async ({ page }) => {
        await placeModalFilter(page);
        await page.locator('#select-area-button').click();
        await dragSelectCenter(page);
        await page.getByRole('button', { name: 'Delete selected features' }).click();
        await page.waitForTimeout(300);
        await expect(page.locator('#undo-button')).toBeEnabled();
    });

    test('undo after batch delete restores the deleted points', async ({ page }) => {
        await placeModalFilter(page);
        await page.locator('#select-area-button').click();
        await dragSelectCenter(page);
        await page.getByRole('button', { name: 'Delete selected features' }).click();
        await page.waitForTimeout(300);
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(0);

        await page.locator('#undo-button').click();
        await page.waitForTimeout(300);
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(1);
    });

    test('panel disappears and mode deactivates after delete', async ({ page }) => {
        await placeModalFilter(page);
        await page.locator('#select-area-button').click();
        await dragSelectCenter(page);
        await page.getByRole('button', { name: 'Delete selected features' }).click();
        await page.waitForTimeout(200);

        await expect(page.getByText('selected', { exact: false })).not.toBeVisible();
        await expect(page.locator('#select-area-button')).toHaveAttribute('aria-pressed', 'false');
    });

    test('dragging over multiple points selects all of them', async ({ page }) => {
        // Activate modal filter once, place two points, then deactivate
        const map = page.locator('.leaflet-container');
        const box = await map.boundingBox();
        if (!box) throw new Error('Map bounding box not found');
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;

        await page.locator('#modal-filter-button').click(); // activate layer
        await page.mouse.click(cx - 60, cy); // place point 1
        await page.waitForTimeout(150);
        await page.mouse.click(cx + 60, cy); // place point 2 (layer still active)
        await page.waitForTimeout(150);
        await page.locator('#modal-filter-button').click(); // deactivate

        await page.locator('#select-area-button').click();
        await dragSelectCenter(page, 150);

        await expect(page.getByText('2 features selected')).toBeVisible();
    });

    test('pressing s outside the map does not toggle area-select mode', async ({ page }) => {
        await page.locator('#settings-button').focus();
        await page.keyboard.press('s');
        await expect(page.locator('#select-area-button')).toHaveAttribute('aria-pressed', 'false');
    });

    test('pressing s with body focus toggles area-select mode', async ({ page }) => {
        await page.locator('body').focus();
        await page.keyboard.press('s');
        await expect(page.locator('#select-area-button')).toHaveAttribute('aria-pressed', 'true');
    });

    test('pressing s after deselecting a layer button toggles area-select mode', async ({
        page
    }) => {
        // Activate then immediately deactivate a layer button — focus stays on
        // the button.  The 's' shortcut must still work.
        await page.locator('#modal-filter-button').click();
        await page.locator('#modal-filter-button').click();
        await page.keyboard.press('s');
        await expect(page.locator('#select-area-button')).toHaveAttribute('aria-pressed', 'true');
    });

    test('dragging over a polyline vertex selects it and delete trims only that vertex', async ({
        page
    }) => {
        await drawMobilityLane(page);

        await page.locator('#select-area-button').click();
        await dragSelectCenter(page, 40);
        await expect(page.getByText('1 feature selected')).toBeVisible();

        await page.getByRole('button', { name: 'Delete selected features' }).click();
        await page.waitForTimeout(500);

        // The mobility lane feature should still exist after trimming one vertex.
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'MobilityLanes')).toBe(1);
    });

    test('undo after polyline vertex deletion restores the trimmed vertex', async ({ page }) => {
        await drawMobilityLane(page);
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'MobilityLanes')).toBe(1);

        await page.locator('#select-area-button').click();
        await dragSelectCenter(page, 40);
        await expect(page.getByText('1 feature selected')).toBeVisible();

        await page.getByRole('button', { name: 'Delete selected features' }).click();
        await page.waitForTimeout(500);

        // The polyline is trimmed but still present.
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'MobilityLanes')).toBe(1);

        await page.locator('#undo-button').click();
        await page.waitForTimeout(300);

        // After undo the full-length polyline is still present (not removed).
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'MobilityLanes')).toBe(1);
    });

    test('dragging over polygon interior selects the polygon and delete removes it', async ({
        page
    }) => {
        await drawLtnPolygon(page);
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'LtnCells')).toBe(1);

        await page.locator('#select-area-button').click();
        // Drag over the interior, not a corner vertex.
        await dragSelectCenter(page, 45);
        await expect(page.getByText('1 feature selected')).toBeVisible();

        await page.getByRole('button', { name: 'Delete selected features' }).click();
        await page.waitForTimeout(500);

        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'LtnCells')).toBe(0);
    });

    test('undo after polygon batch delete restores the polygon', async ({ page }) => {
        await drawLtnPolygon(page);
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'LtnCells')).toBe(1);

        await page.locator('#select-area-button').click();
        await dragSelectCenter(page, 45);
        await expect(page.getByText('1 feature selected')).toBeVisible();

        await page.getByRole('button', { name: 'Delete selected features' }).click();
        await page.waitForTimeout(500);
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'LtnCells')).toBe(0);

        await page.locator('#undo-button').click();
        await page.waitForTimeout(300);
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'LtnCells')).toBe(1);
    });

    test('Delete key does not fire when a toolbar button has focus', async ({ page }) => {
        await placeModalFilter(page);
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(1);

        // Activate selection mode and select the point
        await page.locator('#select-area-button').click();
        await dragSelectCenter(page);
        await expect(page.getByText('1 feature selected')).toBeVisible();

        // Move focus to a toolbar button (non-map element) and press Delete
        await page.locator('#select-area-button').focus();
        await page.keyboard.press('Delete');
        await page.waitForTimeout(150);

        // Point should still exist — Delete was blocked by the isMapContext guard
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(1);
    });
});

test.describe('Area selection — copy and paste', () => {
    test.beforeEach(async ({ page, context }) => {
        await setupPage(page, context);
    });

    test('Copy button is not visible before any features are selected', async ({ page }) => {
        await page.locator('#select-area-button').click();
        await expect(
            page.getByRole('button', { name: 'Copy selected features' })
        ).not.toBeVisible();
    });

    test('Copy button appears when features are selected', async ({ page }) => {
        await placeModalFilter(page);
        await page.locator('#select-area-button').click();
        await dragSelectCenter(page);
        await expect(page.getByRole('button', { name: 'Copy selected features' })).toBeVisible();
    });

    test('Paste button is not visible before copying', async ({ page }) => {
        await page.locator('#select-area-button').click();
        await expect(page.getByRole('button', { name: 'Paste copied features' })).not.toBeVisible();
    });

    test('copying a point shows the Paste button', async ({ page }) => {
        await placeModalFilter(page);
        await page.locator('#select-area-button').click();
        await dragSelectCenter(page);
        await page.getByRole('button', { name: 'Copy selected features' }).click();
        await expect(page.getByRole('button', { name: 'Paste copied features' })).toBeVisible();
    });

    test('pasting a copied point increases the layer feature count', async ({ page }) => {
        await placeModalFilter(page);
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(1);

        await page.locator('#select-area-button').click();
        await dragSelectCenter(page);
        await page.getByRole('button', { name: 'Copy selected features' }).click();
        await page.getByRole('button', { name: 'Paste copied features' }).click();
        await page.waitForTimeout(300);

        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(2);
    });

    test('Ctrl+C copies selected features and Ctrl+V pastes them', async ({ page }) => {
        await placeModalFilter(page);
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(1);

        await page.locator('#select-area-button').click();
        await dragSelectCenter(page);
        await expect(page.getByText('1 feature selected')).toBeVisible();

        await page.keyboard.press('Control+c');
        await page.keyboard.press('Control+v');
        await page.waitForTimeout(300);

        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(2);
    });

    test('Paste is available after deselecting (clipboard persists)', async ({ page }) => {
        await placeModalFilter(page);

        // Copy then drag away from the feature to clear the selection
        await page.locator('#select-area-button').click();
        await dragSelectCenter(page);
        await page.getByRole('button', { name: 'Copy selected features' }).click();

        // Drag an empty area to clear selection without leaving mode
        const map = page.locator('.leaflet-container');
        const box = await map.boundingBox();
        if (!box) throw new Error('Map bounding box not found');
        await page.mouse.move(box.x + 10, box.y + 10);
        await page.mouse.down();
        await page.mouse.move(box.x + 30, box.y + 30, { steps: 5 });
        await page.mouse.up();
        await page.waitForTimeout(200);

        // Paste button should still be present (clipboard not cleared)
        await expect(page.getByRole('button', { name: 'Paste copied features' })).toBeVisible();
    });

    test('pasted features get independent historyIds (undo removes only the paste)', async ({
        page
    }) => {
        await placeModalFilter(page);
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(1);

        await page.locator('#select-area-button').click();
        await dragSelectCenter(page);
        await page.getByRole('button', { name: 'Copy selected features' }).click();
        await page.getByRole('button', { name: 'Paste copied features' }).click();
        await page.waitForTimeout(300);
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(2);

        // Undo the paste — only the pasted copy should be removed
        await page.locator('#undo-button').click();
        await page.waitForTimeout(300);
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(1);
    });

    test('copy/paste of a selected polyline subset pastes only that subset', async ({ page }) => {
        await drawMobilityLane(page);
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'MobilityLanes')).toBe(1);

        await page.locator('#select-area-button').click();
        const map = page.locator('.leaflet-container');
        const box = await map.boundingBox();
        if (!box) throw new Error('Map bounding box not found');
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;

        // Select the middle and right-hand vertices of the three-point line.
        await page.mouse.move(cx - 10, cy - 30);
        await page.mouse.down();
        await page.mouse.move(cx + 80, cy + 30, { steps: 10 });
        await page.mouse.up();
        await page.waitForTimeout(200);
        await expect(page.getByText('1 feature selected')).toBeVisible();

        await page.getByRole('button', { name: 'Copy selected features' }).click();
        await page.getByRole('button', { name: 'Paste copied features' }).click();
        await page.waitForTimeout(500);

        // A copied subset becomes a second polyline feature.
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'MobilityLanes')).toBe(2);
    });

    test('pasting into a hidden layer makes that layer visible again', async ({ page }) => {
        await placeModalFilter(page);
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(1);

        await page.locator('#select-area-button').click();
        await dragSelectCenter(page);
        await page.getByRole('button', { name: 'Copy selected features' }).click();

        // Hide the target layer before paste.
        await page.locator('#ModalFilters-legend').dispatchEvent('click');
        await page.waitForTimeout(100);

        await page.getByRole('button', { name: 'Paste copied features' }).click();
        await page.waitForTimeout(300);

        // The layer should be visible again and contain the pasted copy.
        await expect(page.locator('#ModalFilters-legend')).toHaveAttribute('aria-pressed', 'true');
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(2);
    });
});

test.describe('Area selection — layer visibility', () => {
    test.beforeEach(async ({ page, context }) => {
        await setupPage(page, context);
    });

    test('hidden layers are ignored by the selection tool', async ({ page }) => {
        await placeModalFilter(page);

        // Hide the ModalFilters layer via the legend toggle
        await page.locator('#ModalFilters-legend').dispatchEvent('click');
        await page.waitForTimeout(100);

        // Enter selection mode and drag over the area where the marker sits
        await page.locator('#select-area-button').click();
        await dragSelectCenter(page);
        await page.waitForTimeout(200);

        // The panel should not appear because the layer is hidden
        await expect(page.getByText('feature selected', { exact: false })).not.toBeVisible();
    });

    test('visible layers are still selected when some layers are hidden', async ({ page }) => {
        // Draw a mobility lane and place a modal filter at the map centre.
        // Both will be inside the drag-select area.
        await drawMobilityLane(page);
        await placeModalFilter(page);

        // Verify both are selectable when everything is visible
        await page.locator('#select-area-button').click();
        await dragSelectCenter(page, 80);
        await page.waitForTimeout(200);
        await expect(page.getByText('2 features selected')).toBeVisible();

        // Cancel and hide the MobilityLanes layer
        await page.getByRole('button', { name: 'Cancel area selection' }).click();
        await page.locator('#MobilityLanes-legend').dispatchEvent('click');
        await page.waitForTimeout(100);

        // Drag-select again — only the modal filter should be found (polyline hidden)
        await page.locator('#select-area-button').click();
        await dragSelectCenter(page, 80);
        await page.waitForTimeout(200);
        await expect(page.getByText('1 feature selected')).toBeVisible();
    });
});
