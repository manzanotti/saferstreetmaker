import { expect, type Page } from '@playwright/test';
import { getLayerFeatureCount as getIndexedDbLayerFeatureCount } from '../indexedDbHelpers';

export async function getLayerFeatureCount(page: Page, layerId: string): Promise<number> {
    return await getIndexedDbLayerFeatureCount(page, 'Hello Cleveland', layerId);
}

/** Click at a position relative to the centre of the Leaflet map. */
export async function clickMap(page: Page, offsetX = 0, offsetY = 0) {
    const map = page.locator('.leaflet-container');
    const box = await map.boundingBox();
    if (!box) throw new Error('Map bounding box not found');
    await page.mouse.click(box.x + box.width / 2 + offsetX, box.y + box.height / 2 + offsetY);
    // Layer click handlers call mapStore.markLayerUpdated() synchronously, which
    // triggers a save via a Pinia watch. The short pause lets the persistence
    // work settle before we read IndexedDB.
    await page.waitForTimeout(100);
}

export async function deleteOpenFeaturePopup(page: Page) {
    await page.locator('.popup-buttons .delete-button').first().dispatchEvent('click');
    await page.waitForTimeout(100);
}

export async function waitForHistoryButtons(
    page: Page,
    expected: { canUndo: boolean; canRedo: boolean }
) {
    if (expected.canUndo) {
        await expect(page.locator('#undo-button')).toBeEnabled();
    } else {
        await expect(page.locator('#undo-button')).toBeDisabled();
    }

    if (expected.canRedo) {
        await expect(page.locator('#redo-button')).toBeEnabled();
    } else {
        await expect(page.locator('#redo-button')).toBeDisabled();
    }
}

export async function waitForMapReady(page: Page) {
    await page.addStyleTag({ content: '#help { display: none !important; }' });
    await page.waitForSelector('.toolbar');
    await page.waitForFunction(() => {
        const mapEl = document.getElementById('map');
        return (
            mapEl !== null && Array.from(mapEl.classList).some((c: string) => c.startsWith('zoom-'))
        );
    });
}

/** Draw a two-vertex polyline by clicking twice then double-clicking to finish.
 * Delays between clicks are required: rapid CDP events confuse leaflet.draw's
 * internal state machine, preventing draw:created from firing.
 */
export async function drawPolyline(page: Page) {
    const map = page.locator('.leaflet-container');
    const box = await map.boundingBox();
    if (!box) throw new Error('Map bounding box not found');
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.waitForTimeout(200); // let Vue reactivity settle after button click
    await page.mouse.click(cx - 60, cy);
    await page.waitForTimeout(200);
    await page.mouse.click(cx + 60, cy);
    await page.waitForTimeout(200);
    await page.mouse.dblclick(cx + 60, cy + 60);
    await page.waitForTimeout(500); // wait for the debounced save (draw:created → markLayerUpdated → saveMap)
}

/** Draw a three-vertex polygon by clicking three times then double-clicking to finish. */
export async function drawPolygon(page: Page) {
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
    await page.mouse.click(cx, cy + 40);
    await page.waitForTimeout(200);
    await page.mouse.dblclick(cx, cy + 60);
    await page.waitForTimeout(500);
}

/** Draw a polygon and complete it by returning to the first vertex. */
export async function drawPolygonClosingAtFirstVertex(page: Page) {
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
    await page.mouse.click(cx, cy + 40);
    await page.waitForTimeout(200);
    await page.mouse.dblclick(cx - 60, cy - 40);
    await page.waitForTimeout(500);
}

export async function deleteFirstShape(page: Page) {
    await page
        .locator('.leaflet-overlay-pane path, .leaflet-polygon-pane path, .leaflet-ltns-pane path')
        .first()
        .dispatchEvent('click');
    await page.waitForSelector('.popup-buttons .delete-button');
    await page.locator('.popup-buttons .delete-button').first().dispatchEvent('click');
    await page.waitForTimeout(100);
}
