import { expect, test } from '@playwright/test';
import { getLayerFeatureCount } from './layerMapTestHelpers';
import { setupFreshPage } from './layerTestSetup';
import { getLayerFeatures } from '../indexedDbHelpers';

const polylineLayers = [
    { buttonId: 'mobility-lane', layerId: 'MobilityLanes' },
    { buttonId: 'car-free-street', layerId: 'CarFreeStreets' },
    { buttonId: 'school-street', layerId: 'SchoolStreet' },
    { buttonId: 'one-way-street', layerId: 'OneWayStreets' },
    { buttonId: 'tram-line', layerId: 'TramLines' },
    { buttonId: 'bus-lane', layerId: 'BusLanes' }
];

test.describe('Polyline creation names survive Escape without popup fading', () => {
    test.beforeEach(async ({ page }) => {
        await page.route('**/leaflet@1.9.3/dist/leaflet.min.js', async (route) => {
            const response = await route.fetch();
            await route.fulfill({
                response,
                body: `${await response.text()}\nL.Map.mergeOptions({ fadeAnimation: false });`
            });
        });
    });
    setupFreshPage();

    for (const { buttonId, layerId } of polylineLayers) {
        test(`${layerId} saves a focused name when Escape closes its creation editor`, async ({
            page
        }) => {
            if (buttonId === 'bus-lane') {
                await page.locator('#tram-line-button').click({ button: 'right' });
            }
            const button = page.locator(`#${buttonId}-button`);
            await button.click();
            const mapBox = await page.locator('#map').boundingBox();
            if (!mapBox) {
                throw new Error('Map bounding box not found');
            }
            const centerX = mapBox.x + mapBox.width / 2;
            const centerY = mapBox.y + mapBox.height / 2;
            await page.mouse.click(centerX - 100, centerY);
            await page.waitForTimeout(200);
            await page.mouse.click(centerX + 100, centerY);
            await page.waitForTimeout(200);
            await page.mouse.click(centerX + 100, centerY);

            const editor = page.locator('.leaflet-popup.feature-popup-editor');
            const nameInput = editor.getByRole('textbox', { name: 'Name', exact: true });
            await nameInput.fill('Saved on Escape');
            await expect(nameInput).toBeFocused();
            await nameInput.evaluate((input) => {
                // Model removal paths that do not emit native blur.
                input.addEventListener(
                    'blur',
                    (event) => {
                        if (event.isTrusted) {
                            event.stopImmediatePropagation();
                        }
                    },
                    { capture: true }
                );
            });
            await nameInput.press('Escape');
            await expect(editor).toHaveCount(0);
            await expect
                .poll(async () => {
                    const features = await getLayerFeatures(page, 'Hello Cleveland', layerId);
                    return features.map((feature) => feature.properties?.name);
                })
                .toEqual(['Saved on Escape']);
            await expect(button).toHaveAttribute('aria-pressed', 'false');
            await expect(page.locator('.leaflet-mouse-marker')).toHaveCount(0);
        });
    }
});

test.describe('Polyline creation repeats while the tool remains selected', () => {
    setupFreshPage();

    for (const { buttonId, layerId } of polylineLayers) {
        for (const completion of ['last-point click', 'double-click'] as const) {
            test(`${layerId} can draw another line after ${completion} completion`, async ({
                page
            }) => {
                if (buttonId === 'bus-lane') {
                    await page.locator('#tram-line-button').click({ button: 'right' });
                }
                const button = page.locator(`#${buttonId}-button`);
                await button.click();
                const mapBox = await page.locator('#map').boundingBox();
                if (!mapBox) {
                    throw new Error('Map bounding box not found');
                }
                const centerX = mapBox.x + mapBox.width / 2;
                const centerY = mapBox.y + mapBox.height / 2;

                for (const [index, offsetY] of [-100, 100].entries()) {
                    await page.mouse.click(centerX - 100, centerY + offsetY);
                    await page.waitForTimeout(200);
                    await page.mouse.click(centerX + 100, centerY + offsetY);
                    await page.waitForTimeout(200);
                    if (completion === 'last-point click') {
                        await page.mouse.click(centerX + 100, centerY + offsetY);
                    } else {
                        await page.mouse.dblclick(centerX + 100, centerY + offsetY + 40);
                    }
                    await expect.poll(() => getLayerFeatureCount(page, layerId)).toBe(index + 1);
                    await expect(
                        page.locator(`.leaflet-overlay-pane path.${buttonId}.leaflet-interactive`)
                    ).toHaveCount(index + 1);
                    await expect(button).toHaveAttribute('aria-pressed', 'true');
                    await expect(page.locator('.leaflet-mouse-marker')).toHaveCount(1);
                    await expect(page.locator('#map')).toHaveCSS('cursor', 'crosshair');
                    const editor = page.locator('.leaflet-popup.feature-popup-editor');
                    await expect(editor).toBeVisible();
                    await expect(editor.getByRole('button', { name: 'Save name' })).toHaveCount(0);
                    const nameInput = editor.getByRole('textbox', { name: 'Name', exact: true });
                    await nameInput.fill(`Line ${index + 1}`);
                    await nameInput.press(completion === 'last-point click' ? 'Tab' : 'Enter');
                    await expect(editor).toBeVisible();
                    await expect
                        .poll(async () => {
                            const features = await getLayerFeatures(
                                page,
                                'Hello Cleveland',
                                layerId
                            );
                            return features.map((feature) => feature.properties?.name);
                        })
                        .toEqual(Array.from({ length: index + 1 }, (_, i) => `Line ${i + 1}`));
                }

                const finalName = 'Saved when leaving the tool';
                await page
                    .locator('.leaflet-popup.feature-popup-editor .name-editor')
                    .fill(finalName);
                if (completion === 'last-point click') {
                    await button.click();
                } else {
                    await page.locator('#modal-filter-button').click();
                    await expect(page.locator('#modal-filter-button')).toHaveAttribute(
                        'aria-pressed',
                        'true'
                    );
                }
                await expect(page.locator('.leaflet-popup.feature-popup-editor')).toHaveCount(0);
                await expect
                    .poll(async () => {
                        const features = await getLayerFeatures(page, 'Hello Cleveland', layerId);
                        return features.map((feature) => feature.properties?.name);
                    })
                    .toEqual(['Line 1', finalName]);
                await expect(button).toHaveAttribute('aria-pressed', 'false');
                await expect(page.locator('.leaflet-mouse-marker')).toHaveCount(0);
                if (completion === 'double-click') {
                    await page.locator('#modal-filter-button').click();
                }
                await page.mouse.click(centerX, centerY);
                await expect(page.locator('.leaflet-editing-icon')).toHaveCount(0);
                expect(await getLayerFeatureCount(page, layerId)).toBe(2);
            });
        }
    }
});
