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

async function dragSelectLastModalFilter(page: Page): Promise<void> {
    const marker = page.locator('.leaflet-filters-pane path.modal-filter-marker').last();
    await marker.dispatchEvent('click');
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

async function openGroupDetails(page: Page, name: string): Promise<void> {
    const dialog = page.getByRole('dialog', { name: 'Group details' });
    if (await dialog.isVisible()) {
        return;
    }
    const groupButton = page.getByRole('button', { name: `Select group ${name}` });
    if (!(await groupButton.isVisible())) {
        const groupsButton = page.locator('#groups-button');
        if ((await groupsButton.getAttribute('aria-pressed')) !== 'true') {
            await groupsButton.click();
        }
    }
    await groupButton.click();
    await page.waitForTimeout(100);
    await expect(dialog).toBeVisible();
}

async function createGroup(page: Page, name: string): Promise<void> {
    await page.getByRole('button', { name: 'Add selected features to a group' }).click();
    await page.waitForSelector('#group-name-input');
    await page.locator('#group-name-input').fill(name);
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(300);
}

async function createGroupWithDescription(
    page: Page,
    name: string,
    description: string
): Promise<void> {
    await page.getByRole('button', { name: 'Add selected features to a group' }).click();
    await page.waitForSelector('#group-name-input');
    await page.locator('#group-name-input').fill(name);
    await page.locator('#group-description-input').fill(description);
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(300);
}

async function createGroupVersion(page: Page, name: string): Promise<void> {
    const dialog = page.getByRole('dialog', { name: 'Group details' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Create version' }).click();
    await dialog.getByLabel('New version').fill(name);
    await dialog.getByLabel('Versions').getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(300);
    if (!(await dialog.isVisible())) {
        await openGroupsPanel(page);
        await openGroupDetails(page, 'Versioned Group');
    }
}

async function expectSelectedVersion(page: Page, name: string): Promise<void> {
    await expect(page.getByRole('button', { name: `Select version ${name}` })).toHaveAttribute(
        'aria-pressed',
        'true'
    );
}

async function drawNamedLtnCell(page: Page, name: string, offsetX = 0): Promise<void> {
    await page.locator('#ltn-button').click();
    const map = page.locator('.leaflet-container');
    const box = await map.boundingBox();
    if (!box) throw new Error('Map bounding box not found');
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.waitForTimeout(200);
    await page.mouse.click(cx - 45 + offsetX, cy - 35);
    await page.waitForTimeout(200);
    await page.mouse.click(cx + 45 + offsetX, cy - 35);
    await page.waitForTimeout(200);
    await page.mouse.click(cx + offsetX, cy + 35);
    await page.waitForTimeout(200);
    await page.mouse.dblclick(cx + offsetX, cy + 35);
    const labelInput = page.locator('.label-editor');
    await expect(labelInput).toBeVisible();
    await labelInput.fill(name);
    await labelInput.press('Enter');
    await page.locator('#ltn-button').click();
    await page.waitForTimeout(300);
}

async function drawNamedMobilityLane(page: Page, name: string): Promise<void> {
    await page.locator('#mobility-lane-button').click();
    const map = page.locator('.leaflet-container');
    const box = await map.boundingBox();
    if (!box) throw new Error('Map bounding box not found');
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.waitForTimeout(200);
    await page.mouse.click(cx - 60, cy);
    await page.waitForTimeout(200);
    await page.mouse.click(cx + 60, cy);
    await page.waitForTimeout(200);
    await page.mouse.dblclick(cx + 60, cy + 60);
    const labelInput = page.locator('.leaflet-popup .label-editor');
    await expect(labelInput).toHaveCount(0);
    await page.locator('#mobility-lane-button').click();
    await page.waitForTimeout(300);
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

test.describe('Groups — Group button visibility', () => {
    test.beforeEach(async ({ page, context }) => {
        await setupPage(page, context);
    });

    test('Group button is visible when one feature is selected', async ({ page }) => {
        await placeModalFilter(page);
        await page.locator('#select-area-button').click();
        await dragSelectCenter(page);
        await expect(page.getByText('1 feature selected')).toBeVisible();
        await expect(
            page.getByRole('button', { name: 'Add selected features to a group' })
        ).toBeVisible();
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
    test('group details dialog docks at the bottom and keeps all members visible', async ({
        page
    }) => {
        await placeTwoModalFilters(page, 120);
        await selectBothFilters(page);
        await createGroup(page, 'Viewport Group');

        await openGroupsPanel(page);
        await openGroupDetails(page, 'Viewport Group');

        const dialog = page.getByRole('dialog', { name: 'Group details' });
        await expect
            .poll(async () => {
                const dialogBox = await dialog.boundingBox();
                const viewport = page.viewportSize();
                return dialogBox && viewport
                    ? Math.round(viewport.height - (dialogBox.y + dialogBox.height))
                    : null;
            })
            .toBe(0);
        await expect
            .poll(async () => {
                const dialogBox = await dialog.boundingBox();
                const featureBoxes = await page
                    .locator('.leaflet-filters-pane path.modal-filter-marker')
                    .evaluateAll((features) =>
                        features.map((feature) => feature.getBoundingClientRect().bottom)
                    );
                return dialogBox
                    ? featureBoxes.every((featureBottom) => featureBottom <= dialogBox.y)
                    : false;
            })
            .toBe(true);
    });

    test('creates, sanitizes, renders, and edits a group description', async ({ page }) => {
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await createGroupWithDescription(
            page,
            'School Zone',
            '<p><strong>Slow down</strong> <a href="javascript:alert(1)">here</a><script>alert(1)</script></p>'
        );

        await openGroupsPanel(page);
        await openGroupDetails(page, 'School Zone');
        const description = page
            .getByRole('dialog', { name: 'Group details' })
            .locator('.group-description-content');
        await expect(description).toContainText('Slow down');
        await expect(description.locator('strong')).toHaveText('Slow down');
        await expect(description.locator('script')).toHaveCount(0);
        await expect(description.locator('a')).not.toHaveAttribute('href');

        const dialog = page.getByRole('dialog', { name: 'Group details' });
        const editor = dialog.getByLabel('Description');
        await expect(editor).toHaveAttribute('maxlength', '500');
        await editor.fill('<p>Updated notes</p>');
        await expect(dialog.locator('.group-description-content')).toContainText('Updated notes');
        await dialog.getByRole('button', { name: 'Close group details' }).click();
        await openGroupsPanel(page);
        await openGroupDetails(page, 'School Zone');
        await expect(page.locator('.group-description-content')).toContainText('Updated notes');
    });

    test('group details toggles membership directly without enabling area selection', async ({
        page
    }) => {
        await placeTwoModalFilters(page, 100);
        await page.locator('#select-area-button').click();
        await page
            .locator('.leaflet-filters-pane path.modal-filter-marker')
            .first()
            .dispatchEvent('click');
        await expect(page.getByText('1 feature selected')).toBeVisible();
        await createGroup(page, 'Editable Group');

        await openGroupsPanel(page);
        await openGroupDetails(page, 'Editable Group');
        const dialog = page.getByRole('dialog', { name: 'Group details' });
        await expect(dialog.locator('button.delete-button')).toHaveCount(1);
        await expect(dialog.locator('h2 + button.delete-button')).toHaveCount(1);
        await expect(dialog.locator('button.delete-button')).not.toHaveCSS(
            'background-image',
            'none'
        );
        await expect(page.locator('#map')).not.toHaveClass(/area-select/);
        await expect(page.locator('#select-area-button')).toHaveAttribute('aria-pressed', 'false');
        await expect
            .poll(() => page.locator('#map').evaluate((map) => getComputedStyle(map).cursor))
            .toBe('grab');
        await expect
            .poll(() =>
                page
                    .locator('.leaflet-filters-pane path.modal-filter-marker')
                    .first()
                    .evaluate((feature) => getComputedStyle(feature).cursor)
            )
            .toBe('crosshair');
        await expect(dialog.getByRole('button', { name: 'Add features' })).toHaveCount(0);
        await expect(dialog.getByRole('button', { name: 'Remove all' })).toHaveCount(0);
        await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0);
        await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toHaveCount(0);

        const markers = page.locator('.leaflet-filters-pane path.modal-filter-marker');
        await markers.nth(1).dispatchEvent('click');
        await expect(dialog.getByText('(2 features)', { exact: true })).toBeVisible();
        await page.waitForTimeout(150);
        await markers.first().dispatchEvent('click');
        await expect(dialog.getByText('(1 feature)', { exact: true })).toBeVisible();

        await dialog.getByRole('button', { name: 'Close group details' }).click();
    });

    test('closing group details without editing preserves all members', async ({ page }) => {
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await createGroup(page, 'Unchanged Group');

        await openGroupsPanel(page);
        await openGroupDetails(page, 'Unchanged Group');
        const dialog = page.getByRole('dialog', { name: 'Group details' });
        await expect(dialog.getByText('(2 features)', { exact: true })).toBeVisible();
        await dialog.getByRole('button', { name: 'Close group details' }).click();

        await openGroupsPanel(page);
        await openGroupDetails(page, 'Unchanged Group');
        await expect(
            page.getByRole('dialog', { name: 'Group details' }).getByText('(2 features)', {
                exact: true
            })
        ).toBeVisible();
    });

    test('opening the Groups panel fully closes group editing', async ({ page }) => {
        await placeTwoModalFilters(page);
        await page.locator('#select-area-button').click();
        await page
            .locator('.leaflet-filters-pane path.modal-filter-marker')
            .first()
            .dispatchEvent('click');
        await createGroup(page, 'Panel Close Group');

        await openGroupsPanel(page);
        await openGroupDetails(page, 'Panel Close Group');
        await page.locator('#groups-button').click();

        await expect(page.getByRole('dialog', { name: 'Group details' })).toHaveCount(0);
        await expect(page.locator('.leaflet-filters-pane path[stroke="#3b82f6"]')).toHaveCount(0);
        const ungroupedMarker = page
            .locator('.leaflet-filters-pane path.modal-filter-marker')
            .last();
        await ungroupedMarker.dispatchEvent('click');
        await expect(page.locator('.leaflet-popup')).toBeVisible();

        await page.keyboard.press('Escape');
        await openGroupsPanel(page);
        await openGroupDetails(page, 'Panel Close Group');
        await expect(
            page.getByRole('dialog', { name: 'Group details' }).getByText('(1 feature)', {
                exact: true
            })
        ).toBeVisible();
    });

    test('removing the final member offers to delete the empty group', async ({ page }) => {
        await placeModalFilter(page);
        await page.locator('#select-area-button').click();
        await dragSelectLastModalFilter(page);
        await expect(page.getByText('1 feature selected')).toBeVisible();
        await createGroup(page, 'Single Member Group');

        await openGroupsPanel(page);
        await openGroupDetails(page, 'Single Member Group');
        const marker = page.locator('.leaflet-filters-pane path.modal-filter-marker').first();
        const markerBox = await marker.boundingBox();
        if (!markerBox) throw new Error('Grouped modal filter not found');
        await page.mouse.click(
            markerBox.x + markerBox.width / 2,
            markerBox.y + markerBox.height / 2
        );

        await expect(page.getByText('Single Member Group is now empty.')).toBeVisible();
        await page.getByRole('button', { name: 'Delete', exact: true }).click();
        await expect(
            page.getByRole('button', { name: /Select group Single Member Group/ })
        ).toHaveCount(0);
        await expect(marker).toHaveCount(1);
    });

    test('undoing final-member removal hides the empty-group deletion prompt', async ({ page }) => {
        await placeModalFilter(page);
        await page.locator('#select-area-button').click();
        await dragSelectLastModalFilter(page);
        await expect(page.getByText('1 feature selected')).toBeVisible();
        await createGroup(page, 'Undo Empty Group');

        await openGroupsPanel(page);
        await openGroupDetails(page, 'Undo Empty Group');
        const marker = page.locator('.leaflet-filters-pane path.modal-filter-marker').first();
        const markerBox = await marker.boundingBox();
        if (!markerBox) throw new Error('Grouped modal filter not found');
        await page.mouse.click(
            markerBox.x + markerBox.width / 2,
            markerBox.y + markerBox.height / 2
        );
        await expect(page.getByText('Undo Empty Group is now empty.')).toBeVisible();

        await page.locator('#undo-button').click();

        await expect(page.getByText('Undo Empty Group is now empty.')).toHaveCount(0);
        await expect(
            page.getByRole('button', { name: /Select group Undo Empty Group/ })
        ).toContainText('(1)');
        await expect(page.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0);
    });

    test('the map remains pannable while group details are open', async ({ page }) => {
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await createGroup(page, 'Pannable Group');
        await openGroupsPanel(page);
        await openGroupDetails(page, 'Pannable Group');

        const map = page.locator('.leaflet-container');
        const mapPane = page.locator('.leaflet-map-pane');
        const mapBox = await map.boundingBox();
        if (!mapBox) throw new Error('Map bounding box not found');
        const beforeTransform = await mapPane.evaluate((pane) => pane.getAttribute('style'));
        const startX = mapBox.x + 90;
        const startY = mapBox.y + 120;
        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.mouse.move(startX + 100, startY + 40, { steps: 10 });
        await page.mouse.up();

        await expect
            .poll(() => mapPane.evaluate((pane) => pane.getAttribute('style')))
            .not.toBe(beforeTransform);
        await expect(page.getByRole('dialog', { name: 'Group details' })).toBeVisible();
    });

    test('feature hover popup renders the descriptions of its groups', async ({ page }) => {
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await createGroupWithDescription(page, 'School Zone', '<p>Slow down near school</p>');

        const marker = page.locator('.leaflet-filters-pane path.modal-filter-marker').first();
        await marker.dispatchEvent('mouseover');

        const popup = page.locator('.leaflet-popup');
        await expect(popup).toBeVisible();
        await expect(popup.locator('.feature-popup-group-description')).toContainText(
            'School Zone'
        );
        await expect(popup.locator('.feature-popup-description')).toContainText(
            'Slow down near school'
        );
    });

    test('polygon hover popup renders the descriptions of its groups', async ({ page }) => {
        await drawNamedLtnCell(page, 'School cell');

        await page.locator('#select-area-button').click();
        const polygon = page
            .locator('.leaflet-ltns-pane path.ltn-cell.leaflet-interactive')
            .first();
        await polygon.dispatchEvent('click', { shiftKey: true });
        await expect(page.getByText('1 feature selected')).toBeVisible();
        await createGroupWithDescription(page, 'School Zone', '<p>Slow down near school</p>');

        await polygon.dispatchEvent('mouseover');

        const popup = page.locator('.leaflet-popup');
        await expect(popup).toBeVisible();
        await expect(popup.locator('.feature-popup-group-description')).toContainText(
            'School Zone'
        );
        await expect(popup.locator('.feature-popup-description')).toContainText(
            'Slow down near school'
        );

        await popup.hover();
        await expect(popup).toBeVisible();
        await popup.getByRole('button', { name: 'School Zone' }).click();
        await expect(page.getByRole('dialog', { name: 'Group details' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Save group changes' })).toHaveCount(0);
        await expect(
            page.getByRole('button', { name: 'Add selected features to a group' })
        ).toHaveCount(0);
        await expect(page.locator('.leaflet-popup.feature-popup-editor')).toHaveCount(0);
    });

    test('polygon hover popup closes when the pointer leaves the polygon', async ({ page }) => {
        await drawNamedLtnCell(page, 'School cell');

        await page.locator('#select-area-button').click();
        const polygon = page
            .locator('.leaflet-ltns-pane path.ltn-cell.leaflet-interactive')
            .first();
        await polygon.dispatchEvent('click', { shiftKey: true });
        await expect(page.getByText('1 feature selected')).toBeVisible();
        await createGroupWithDescription(page, 'School Zone', '<p>Slow down near school</p>');

        await polygon.dispatchEvent('mouseover');
        await expect(page.locator('.leaflet-popup')).toBeVisible();

        await polygon.dispatchEvent('mouseout');
        await expect(page.locator('.leaflet-popup')).toHaveCount(0);
    });

    test('polyline hover popup shows while its editor is open', async ({ page }) => {
        await placeModalFilter(page, 110);
        await drawNamedMobilityLane(page, 'Mobility lane');

        await page.locator('#select-area-button').click();
        await dragSelectCenter(page, 160);
        await expect(page.getByText('2 features selected')).toBeVisible();
        await createGroupWithDescription(page, 'School Zone', '<p>Slow down near school</p>');

        const polyline = page
            .locator('.leaflet-overlay-pane path.mobility-lane.leaflet-interactive')
            .first();
        await page.locator('#mobility-lane-button').click();
        await polyline.dispatchEvent('click');
        await expect(page.locator('.leaflet-popup')).toBeVisible();

        const marker = page.locator('.leaflet-filters-pane path.modal-filter-marker').first();
        await marker.hover();
        await expect(page.locator('.leaflet-popup.feature-popup-hover')).toBeVisible();
    });

    test('polyline hover popup shows while its editor is open on the same feature', async ({
        page
    }) => {
        await drawNamedMobilityLane(page, 'Mobility lane');

        await page.locator('#select-area-button').click();
        const polyline = page
            .locator('.leaflet-overlay-pane path.mobility-lane.leaflet-interactive')
            .first();
        await polyline.dispatchEvent('click', { shiftKey: true });
        await expect(page.getByText('1 feature selected')).toBeVisible();
        await createGroupWithDescription(page, 'School Zone', '<p>Slow down near school</p>');

        await page.locator('#mobility-lane-button').click();
        await polyline.dispatchEvent('click');
        await expect(page.locator('.leaflet-popup')).toBeVisible();

        await polyline.dispatchEvent('mouseover');
        await expect(page.locator('.leaflet-popup.feature-popup-hover')).toBeVisible();
    });

    test('polygon hover popup shows while a polyline editor is open', async ({ page }) => {
        await drawNamedLtnCell(page, 'School cell');

        await page.locator('#select-area-button').click();
        const polygon = page
            .locator('.leaflet-ltns-pane path.ltn-cell.leaflet-interactive')
            .first();
        await polygon.dispatchEvent('click', { shiftKey: true });
        await expect(page.getByText('1 feature selected')).toBeVisible();
        await createGroupWithDescription(page, 'School Zone', '<p>Slow down near school</p>');

        await drawNamedMobilityLane(page, 'Mobility lane');
        const polyline = page
            .locator('.leaflet-overlay-pane path.mobility-lane.leaflet-interactive')
            .first();
        await page.locator('#mobility-lane-button').click();
        await polyline.dispatchEvent('click');
        await expect(page.locator('.leaflet-popup')).toBeVisible();

        await polygon.dispatchEvent('mouseover');
        await expect(page.locator('.leaflet-popup.feature-popup-hover')).toBeVisible();
    });

    test('polygon click popup lists its groups', async ({ page }) => {
        await drawNamedLtnCell(page, 'School cell');

        await page.locator('#select-area-button').click();
        const polygon = page
            .locator('.leaflet-ltns-pane path.ltn-cell.leaflet-interactive')
            .first();
        await polygon.dispatchEvent('click', { shiftKey: true });
        await expect(page.getByText('1 feature selected')).toBeVisible();
        await createGroupWithDescription(page, 'School Zone', '<p>Slow down near school</p>');

        await page.locator('#ltn-button').click();
        await polygon.dispatchEvent('click');

        const popup = page.locator('.leaflet-popup');
        await expect(popup).toBeVisible();
        await expect(popup.locator('.feature-popup-groups')).toContainText('School Zone');
        const popupControls = popup.locator('.ltn-popup-buttons > *');
        await expect(popupControls.nth(0)).toHaveClass(/current-controls/);
        await expect(popupControls.nth(1)).toHaveClass(/feature-popup-group-content/);
        await expect(popupControls).toHaveCount(2);
        await expect(popup.locator('.label-editor')).toHaveCSS('border-top-width', '1px');
        await expect(popup.locator('.label-editor')).toHaveCSS(
            'border-top-color',
            'rgb(209, 213, 219)'
        );
        await expect(popup.locator('.colour-swatch')).toHaveCSS('border-top-width', '1px');
        await expect(popup.locator('.colour-swatch')).toHaveCSS(
            'border-top-color',
            'rgb(209, 213, 219)'
        );
        await expect(popup.locator('.label-editor')).toHaveCSS('padding-top', '4px');
        await expect(popup.locator('.label-editor')).toHaveCSS('padding-left', '8px');
        await expect(popup.locator('.ltn-popup-buttons > .feature-popup-group-content')).toHaveCSS(
            'margin-top',
            '12px'
        );
    });

    test('keeps a grouped LTN outline colour after leaving edit mode', async ({ page }) => {
        await drawNamedLtnCell(page, 'School cell');
        await placeModalFilter(page, 120);

        await page.locator('#select-area-button').click();
        const polygon = page.locator('.leaflet-ltns-pane path.ltn-cell.leaflet-interactive');
        const modalFilter = page.locator('.leaflet-filters-pane path.modal-filter-marker');
        await dragSelectCenter(page, 180);
        await expect(page.getByText('2 features selected')).toBeVisible();
        await createGroup(page, 'School Zone');
        await openGroupsPanel(page);
        await openGroupDetails(page, 'School Zone');
        const originalGroupedStroke = await polygon.getAttribute('stroke');
        await page.locator('#group-details-colour').fill('#0088aa');
        await expect(polygon).toHaveAttribute('stroke', '#0088aa');
        await page
            .getByRole('dialog', { name: 'Group details' })
            .getByRole('button', { name: 'Close group details' })
            .click();
        await page.waitForTimeout(150);

        const groupedStroke = await polygon.getAttribute('stroke');
        expect(originalGroupedStroke).toBeTruthy();
        expect(groupedStroke).toBe('#0088aa');
        expect(groupedStroke).not.toBe('#cc00cc');
        await expect(page.locator('.leaflet-filters-pane path[stroke="#3b82f6"]')).toHaveCount(0);
        await expect(page.locator('.leaflet-filters-pane path[stroke="green"]')).toHaveCount(
            await modalFilter.count()
        );

        await page.locator('#undo-button').click();
        await expect(polygon).toHaveAttribute('stroke', originalGroupedStroke!);
        await page.locator('#redo-button').click();
        await expect(polygon).toHaveAttribute('stroke', groupedStroke!);

        await page.locator('#ltn-button').click();
        await polygon.dispatchEvent('click');
        await expect(page.locator('.popup-buttons')).toHaveCount(1);
        await expect(polygon).toHaveAttribute('stroke', groupedStroke!);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(150);

        await expect(polygon).toHaveAttribute('stroke', groupedStroke!);
    });

    test('ungrouped feature editor uses selection mode to add to a group', async ({ page }) => {
        await placeModalFilter(page, -120);
        await page.locator('#select-area-button').click();
        await dragSelectCenter(page, 80, -120);
        await expect(page.getByText('1 feature selected')).toBeVisible();
        await createGroup(page, 'Alpha Zone');

        await drawNamedLtnCell(page, 'School cell');
        await page.locator('#ltn-button').click();
        const polygon = page
            .locator('.leaflet-ltns-pane path.ltn-cell.leaflet-interactive')
            .first();
        await polygon.dispatchEvent('click');

        const popup = page.locator('.leaflet-popup');
        await expect(popup.locator('.feature-popup-groups')).toContainText('None');
        const groupSelect = popup.locator('.add-feature-to-group-select');
        await expect(groupSelect).toBeVisible();
        await expect(groupSelect.locator('option')).toHaveText([
            'Add to group…',
            'Create new group…',
            'Alpha Zone'
        ]);

        await groupSelect.selectOption({ label: 'Alpha Zone' });
        await expect(popup.locator('.feature-popup-groups')).toContainText('Alpha Zone');
        await expect(popup.locator('.feature-popup-group-none')).toHaveCount(0);
    });

    test('adds a newly created LTN group immediately from the LTN popup', async ({ page }) => {
        await drawNamedLtnCell(page, 'Immediate group cell');
        await page.locator('#ltn-button').click();
        const polygon = page
            .locator('.leaflet-ltns-pane path.ltn-cell.leaflet-interactive')
            .first();
        await polygon.dispatchEvent('click');

        const popup = page.locator('.leaflet-popup');
        const groupSelect = popup.locator('.add-feature-to-group-select');
        await groupSelect.selectOption({ label: 'Create new group…' });
        await page.getByLabel('Group name').fill('Immediate LTN Group');
        await page.getByRole('button', { name: 'Save' }).click();

        await expect(groupSelect.locator('option:checked')).toHaveText('Immediate LTN Group');
        await expect(popup.locator('.feature-popup-groups')).toContainText('Immediate LTN Group');
        await expect(popup.locator('.feature-popup-group-none')).toHaveCount(0);
        await expect(popup.getByRole('button', { name: 'Apply LTN cell changes' })).toHaveCount(0);
        await expect(popup.getByRole('button', { name: 'Cancel LTN cell changes' })).toHaveCount(0);
    });

    test('creates a group from the selected feature popup', async ({ page }) => {
        await placeModalFilter(page);

        const marker = page.locator('.leaflet-filters-pane path.modal-filter-marker').first();
        await marker.dispatchEvent('click');
        const popup = page.locator('.leaflet-popup');
        const groupSelect = popup.locator('.add-feature-to-group-select');

        await expect(groupSelect.locator('option')).toHaveText([
            'Add to group…',
            'Create new group…'
        ]);
        await groupSelect.selectOption({ label: 'Create new group…' });
        await page.getByLabel('Group name').fill('Single Feature Group');
        await page.getByRole('button', { name: 'Save' }).click();

        await expect(groupSelect.locator('option:checked')).toHaveText('Single Feature Group');
        await expect(popup.locator('.feature-popup-groups')).toContainText('Single Feature Group');
        await expect(popup.locator('.feature-popup-group-none')).toHaveCount(0);
    });

    test('read-only feature click renders the description popup without actions', async ({
        page
    }) => {
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await createGroupWithDescription(page, 'School Zone', '<p>Slow down near school</p>');

        await page.locator('#settings-button').click();
        await page.locator('#read-only').check();
        await page.getByRole('button', { name: 'Save' }).click();

        const marker = page.locator('.leaflet-filters-pane path.modal-filter-marker').first();
        await marker.dispatchEvent('click');

        const popup = page.locator('.leaflet-popup');
        await expect(popup).toBeVisible();
        await expect(popup).toHaveClass(/feature-popup-description/);
        await expect(popup.locator('.feature-popup-description')).toContainText(
            'Slow down near school'
        );
        await expect(popup.locator('.popup-buttons')).toHaveCount(0);
    });

    test('read-only group details cannot edit metadata, membership, or phases', async ({
        page
    }) => {
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await createGroup(page, 'Read-only Group');

        await page.locator('#settings-button').click();
        await page.locator('#read-only').check();
        await page.getByRole('button', { name: 'Save' }).click();
        await openGroupsPanel(page);
        await openGroupDetails(page, 'Read-only Group');

        const dialog = page.getByRole('dialog', { name: 'Group details' });
        await expect(dialog.getByLabel('Group name')).toBeDisabled();
        await expect(dialog.getByLabel('Description')).toBeDisabled();
        await expect(dialog.getByLabel('Choose group colour')).toBeDisabled();
        await expect(dialog.getByRole('button', { name: /Phases for version/ })).toHaveCount(0);
        await expect(dialog.getByRole('button', { name: 'Create version' })).toHaveCount(0);

        await page
            .locator('.leaflet-filters-pane path.modal-filter-marker')
            .first()
            .dispatchEvent('click');
        await expect(page.locator('.leaflet-popup.feature-popup-description')).toBeVisible();
        await expect(dialog.getByText('(2 features)', { exact: true })).toBeVisible();
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
        await openGroupDetails(page, 'Old Name');
        const nameInput = page.getByLabel('Group name');
        await nameInput.fill('');
        await nameInput.pressSequentially('New Name');
        await page
            .getByRole('dialog', { name: 'Group details' })
            .getByRole('button', { name: 'Close group details' })
            .click();

        await openGroupsPanel(page);
        await expect(page.getByRole('button', { name: /Select group New Name/ })).toBeVisible();
        await expect(page.getByRole('button', { name: /Select group Old Name/ })).not.toBeVisible();

        await page.getByRole('button', { name: 'Close groups panel' }).click();
        await page.locator('#undo-button').click();
        await openGroupsPanel(page);
        await expect(page.getByRole('button', { name: /Select group Old Name/ })).toBeVisible();
        await expect(page.getByRole('button', { name: /Select group New Name/ })).toHaveCount(0);
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

    test('clicking a group member removes it from the group', async ({ page }) => {
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await createGroup(page, 'Toggle Group');

        await openGroupsPanel(page);
        await page.getByRole('button', { name: /Select group Toggle Group/ }).click();
        await page.waitForTimeout(300);

        const selectedFilters = page.locator('.leaflet-filters-pane path[stroke="#3b82f6"]');
        await expect(selectedFilters).toHaveCount(2);

        const selectedFilterBox = await selectedFilters.first().boundingBox();
        if (!selectedFilterBox) throw new Error('Selected modal filter not found');
        await page.mouse.click(
            selectedFilterBox.x + selectedFilterBox.width / 2,
            selectedFilterBox.y + selectedFilterBox.height / 2
        );
        await page.waitForTimeout(200);

        await expect(selectedFilters).toHaveCount(1);
        await page.getByRole('button', { name: 'Close group details' }).click();
        await openGroupsPanel(page);
        await openGroupDetails(page, 'Toggle Group');
        await expect(
            page.getByRole('dialog', { name: 'Group details' }).getByText('(1 feature)', {
                exact: true
            })
        ).toBeVisible();

        await page.getByRole('button', { name: 'Close group details' }).click();
        await page.locator('#undo-button').click();
        await openGroupsPanel(page);
        await openGroupDetails(page, 'Toggle Group');
        await expect(
            page.getByRole('dialog', { name: 'Group details' }).getByText('(2 features)', {
                exact: true
            })
        ).toBeVisible();

        await page.getByRole('button', { name: 'Close group details' }).click();
        await page.locator('#redo-button').click();
        await openGroupsPanel(page);
        await openGroupDetails(page, 'Toggle Group');
        await expect(
            page.getByRole('dialog', { name: 'Group details' }).getByText('(1 feature)', {
                exact: true
            })
        ).toBeVisible();
    });

    test('Escape clears all highlights after selecting a group', async ({ page }) => {
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await createGroup(page, 'Escape Group');

        await openGroupsPanel(page);
        await page.getByRole('button', { name: /Select group Escape Group/ }).click();
        await expect(page.locator('.leaflet-filters-pane path[stroke="#3b82f6"]')).toHaveCount(2);

        await page.keyboard.press('Escape');
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
        const finalCloseGroupsButton = page.getByRole('button', { name: 'Close groups panel' });
        if (await finalCloseGroupsButton.isVisible()) {
            await finalCloseGroupsButton.click();
        }
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
        await openGroupDetails(page, 'Versioned Group');
        await createGroupVersion(page, 'Alternative');
        await expectSelectedVersion(page, 'Alternative');
        await expect(page.locator('.leaflet-filters-pane path[stroke="#3b82f6"]')).toHaveCount(2);
    });

    test('deleting a version only prompts, keeps its elements, and clears highlights', async ({
        page
    }) => {
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(4);

        await page.getByRole('button', { name: 'Delete version Alternative' }).click();

        await expect(page.getByText('Delete version Alternative?')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Delete version only' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Delete version + elements' })).toBeVisible();
        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(4);

        await page.getByRole('button', { name: 'Delete version only' }).click();
        await page.waitForTimeout(300);

        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(4);
        await expect(
            page.getByRole('button', { name: 'Select version Alternative' })
        ).not.toBeVisible();
        await expect(page.locator('.leaflet-filters-pane path[stroke="#3b82f6"]')).toHaveCount(0);
    });

    test('deleting a version with its elements removes its features and clears highlights', async ({
        page
    }) => {
        await page.getByRole('button', { name: 'Delete version Alternative' }).click();
        await page.getByRole('button', { name: 'Delete version + elements' }).click();
        await page.waitForTimeout(300);

        expect(await getLayerFeatureCount(page, 'Hello Cleveland', 'ModalFilters')).toBe(2);
        await expect(
            page.getByRole('button', { name: 'Select version Alternative' })
        ).not.toBeVisible();
        await expect(page.locator('.leaflet-filters-pane path[stroke="#3b82f6"]')).toHaveCount(0);
    });
});

test.describe('Groups — Phases', () => {
    test.beforeEach(async ({ page, context }) => {
        await setupPage(page, context);
    });

    test('creates the first phase and initializes an additional phase from unassigned features', async ({
        page
    }) => {
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await createGroup(page, 'Phased Group');

        await openGroupsPanel(page);
        await openGroupDetails(page, 'Phased Group');
        await expect(
            page.getByRole('dialog', { name: 'Group details' }).getByText('(2 features)', {
                exact: true
            })
        ).toBeVisible();
        await expect(page.getByRole('button', { name: 'Phases for version Default' })).toHaveText(
            'Phases (0)'
        );
        await page.getByRole('button', { name: 'Phases for version Default' }).click();

        await expect(page.getByText('Edit Phase 1', { exact: true })).toBeVisible();
        await expect(
            page.getByRole('dialog', { name: /Phased Group \/ Default phases/ })
        ).toBeVisible();
        await expect(
            page.getByRole('dialog', { name: /Phased Group \/ Default phases/ })
        ).not.toHaveAttribute('aria-modal');
        const phaseDialog = page.getByRole('dialog', {
            name: /Phased Group \/ Default phases/
        });
        await expect
            .poll(async () => (await phaseDialog.boundingBox())?.width ?? Number.POSITIVE_INFINITY)
            .toBeLessThanOrEqual(448);
        await expect
            .poll(async () => {
                const dialogBox = await phaseDialog.boundingBox();
                const viewport = page.viewportSize();
                return dialogBox && viewport
                    ? Math.round(viewport.height - (dialogBox.y + dialogBox.height))
                    : null;
            })
            .toBe(0);
        await expect
            .poll(async () => {
                const dialogBox = await phaseDialog.boundingBox();
                const featureBoxes = await page
                    .locator('.leaflet-filters-pane path.modal-filter-marker')
                    .evaluateAll((features) =>
                        features.map((feature) => feature.getBoundingClientRect().bottom)
                    );
                return dialogBox
                    ? featureBoxes.every((featureBottom) => featureBottom <= dialogBox.y)
                    : false;
            })
            .toBe(true);
        await expect(page.getByRole('button', { name: 'Save phase' })).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toHaveCount(0);
        await page
            .locator('.leaflet-filters-pane path.modal-filter-marker')
            .first()
            .dispatchEvent('click');

        await expect(page.getByRole('button', { name: 'Edit Phase 1' })).toBeVisible();
        await expect(page.getByText('1 feature', { exact: true })).toBeVisible();
        await expect(page.locator('#select-area-button')).toHaveAttribute('aria-pressed', 'false');

        await page
            .locator('.leaflet-filters-pane path.modal-filter-marker')
            .first()
            .dispatchEvent('click');
        await expect(page.getByText('2 features', { exact: true })).toBeVisible();
        await expect(page.locator('#select-area-button')).toHaveAttribute('aria-pressed', 'false');

        await page
            .locator('.leaflet-filters-pane path.modal-filter-marker')
            .first()
            .dispatchEvent('click');
        await expect(page.getByText('1 feature', { exact: true })).toBeVisible();

        await page.getByRole('button', { name: 'New phase' }).click();
        await expect(page.getByText('Edit Phase 2', { exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Edit Phase 2' })).toBeVisible();
        await expect(page.getByRole('button', { name: /Move Phase/ })).toHaveCount(0);
        const phaseIdsBeforeMove = await page.evaluate(() => {
            const app = (document.getElementById('app') as any).__vue_app__;
            const groupStore = app?.config?.globalProperties?.$pinia?._s?.get('group');
            return groupStore.groups[0].versions[0].phases.map((phase: any) => phase.id);
        });
        await page.getByRole('button', { name: 'Edit Phase 2' }).press('ArrowUp');
        await expect
            .poll(() =>
                page.evaluate(() => {
                    const app = (document.getElementById('app') as any).__vue_app__;
                    const groupStore = app?.config?.globalProperties?.$pinia?._s?.get('group');
                    return groupStore.groups[0].versions[0].phases.map((phase: any) => phase.id);
                })
            )
            .toEqual([...phaseIdsBeforeMove].reverse());
        await page.waitForTimeout(100);

        await page.getByRole('button', { name: 'Close phases' }).click();
        await expect(
            page.getByRole('dialog', { name: /Phased Group \/ Default phases/ })
        ).not.toBeVisible();
        await expect(page.locator('.leaflet-filters-pane path[stroke="#3b82f6"]')).toHaveCount(0);
        await expect(page.locator('.leaflet-filters-pane path[stroke="green"]')).toHaveCount(2);
        await openGroupsPanel(page);
        await openGroupDetails(page, 'Phased Group');
        await expect(page.getByRole('button', { name: 'Phases for version Default' })).toHaveText(
            'Phases (2)'
        );
        await page.getByRole('button', { name: 'Close group details' }).click();
        await page.getByRole('button', { name: 'Undo' }).click();
        await page.getByRole('button', { name: 'Undo' }).click();

        await expect(
            page.getByRole('dialog', { name: /Phased Group \/ Default phases/ })
        ).toBeVisible();
        await expect(page.getByRole('button', { name: 'Edit Phase 1' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Edit Phase 2' })).toHaveCount(0);
    });

    test('does not add a feature outside the group version to a phase', async ({ page }) => {
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        await createGroup(page, 'Bounded Phase Group');
        await placeModalFilter(page, 180);

        await openGroupsPanel(page);
        await openGroupDetails(page, 'Bounded Phase Group');
        await page.getByRole('button', { name: 'Phases for version Default' }).click();
        const phaseRow = page.getByRole('listitem').filter({ hasText: 'Phase 1' });
        await expect(phaseRow).toContainText('2 features');

        await page
            .locator('.leaflet-filters-pane path.modal-filter-marker')
            .last()
            .dispatchEvent('click');

        await expect(phaseRow).toContainText('2 features');
        await page.getByRole('button', { name: 'Close phases' }).click();
        await openGroupsPanel(page);
        await openGroupDetails(page, 'Bounded Phase Group');
        await page.getByRole('button', { name: 'Phases for version Default' }).click();
        await expect(page.getByRole('listitem').filter({ hasText: 'Phase 1' })).toContainText(
            '2 features'
        );
    });

    test('edits phase membership and offers to delete a phase made empty', async ({ page }) => {
        await placeTwoModalFilters(page);
        await selectBothFilters(page);
        const markers = page.locator('.leaflet-filters-pane path.modal-filter-marker');
        await createGroup(page, 'Editable Phase Group');

        await openGroupsPanel(page);
        await openGroupDetails(page, 'Editable Phase Group');
        await page.getByRole('button', { name: 'Phases for version Default' }).click();
        await expect(page.getByText('Edit Phase 1', { exact: true })).toBeVisible();
        await markers.first().dispatchEvent('click');
        await expect(page.getByText('1 feature', { exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Save group changes' })).toHaveCount(0);
        await page.getByRole('button', { name: 'Undo' }).click();
        await expect(page.getByText('2 features', { exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Redo' }).click();
        await expect(page.getByText('1 feature', { exact: true })).toBeVisible();

        await page.getByRole('button', { name: 'Close phases' }).click();
        await openGroupsPanel(page);
        await openGroupDetails(page, 'Editable Phase Group');
        await page.getByRole('button', { name: 'Phases for version Default' }).click();
        await expect(page.getByText('1 feature', { exact: true })).toBeVisible();

        await page.getByRole('button', { name: 'Edit Phase 1' }).click();
        await markers.last().dispatchEvent('click');

        await expect(page.getByText('Select at least one feature.')).toBeVisible();
        await expect(page.getByText('This phase has no features. Delete the phase?')).toBeVisible();
        await page.getByRole('button', { name: 'Delete phase' }).click();
        await expect(page.getByRole('button', { name: 'Edit Phase 1' })).toHaveCount(0);
        await expect(page.getByText('No phases have been saved for this version.')).toBeVisible();
    });

    test('adds multiple unassigned point features to a mixed phase with plain clicks', async ({
        page
    }) => {
        await drawNamedLtnCell(page, 'First phase cell', -60);
        await drawNamedLtnCell(page, 'Second phase cell', 60);
        await page.locator('#modal-filter-button').click();
        const map = page.locator('.leaflet-container');
        const box = await map.boundingBox();
        if (!box) throw new Error('Map bounding box not found');
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        await page.mouse.click(cx - 80, cy);
        await page.waitForTimeout(150);
        await page.mouse.click(cx, cy);
        await page.waitForTimeout(150);
        await page.mouse.click(cx + 80, cy);
        await page.waitForTimeout(150);
        await page.locator('#modal-filter-button').click();

        await page.locator('#select-area-button').click();
        await dragSelectCenter(page, 190);
        await expect(page.getByText('5 features selected')).toBeVisible();
        await createGroup(page, 'Mixed Phase Group');
        await page.waitForTimeout(200);

        await openGroupsPanel(page);
        await openGroupDetails(page, 'Mixed Phase Group');
        await page.getByRole('button', { name: 'Phases for version Default' }).click();
        await expect(page.getByRole('button', { name: 'Edit Phase 1' })).toBeVisible();
        await expect(page.getByRole('listitem').getByText('5 features')).toBeVisible();

        const cells = page.locator('.leaflet-ltns-pane path.ltn-cell.leaflet-interactive');
        const filters = page.locator('.leaflet-filters-pane path.modal-filter-marker');
        await cells.first().dispatchEvent('click');
        await cells.nth(1).dispatchEvent('click');
        await expect(page.getByRole('listitem').getByText('3 features')).toBeVisible();
        await expect(page.locator('#select-area-button')).toHaveAttribute('aria-pressed', 'false');
        const firstFilterBox = await filters.first().boundingBox();
        if (!firstFilterBox) throw new Error('Modal filter bounding box not found');
        await page.mouse.click(
            firstFilterBox.x + firstFilterBox.width / 2,
            firstFilterBox.y + firstFilterBox.height / 2
        );
        await expect(page.getByRole('listitem').getByText('2 features')).toBeVisible();
        await filters.nth(1).dispatchEvent('click');
        await expect(page.getByText('1 feature', { exact: true })).toBeVisible();

        await filters.first().dispatchEvent('click');
        await expect(page.getByRole('listitem').getByText('2 features')).toBeVisible();
        await filters.nth(1).dispatchEvent('click');
        await expect(page.getByRole('listitem').getByText('3 features')).toBeVisible();
    });

    test('keeps an LTN cell coloured when removing it from a phase draft', async ({ page }) => {
        await drawNamedLtnCell(page, 'Phase cell');
        await placeModalFilter(page, 120);
        const cell = page.locator('.leaflet-ltns-pane path.ltn-cell.leaflet-interactive');
        await page.locator('#select-area-button').click();
        await dragSelectCenter(page, 180);
        await expect(page.getByText('2 features selected')).toBeVisible();
        await createGroup(page, 'LTN Phase Group');

        await openGroupsPanel(page);
        await openGroupDetails(page, 'LTN Phase Group');
        await page.locator('#group-details-colour').fill('#0088aa');
        await page
            .getByRole('dialog', { name: 'Group details' })
            .getByRole('button', { name: 'Close group details' })
            .click();
        await openGroupsPanel(page);
        await openGroupDetails(page, 'LTN Phase Group');
        await page.getByRole('button', { name: 'Phases for version Default' }).click();

        await expect
            .poll(() =>
                page.evaluate(() => {
                    const app = (document.getElementById('app') as any).__vue_app__;
                    const selectionStore =
                        app?.config?.globalProperties?.$pinia?._s?.get('selection');
                    return {
                        isPhaseEditing: selectionStore?.isPhaseEditing,
                        isGroupSelection: selectionStore?.isGroupSelection
                    };
                })
            )
            .toEqual({ isPhaseEditing: true, isGroupSelection: true });
        await page.evaluate(() => {
            const app = (document.getElementById('app') as any).__vue_app__;
            const pinia = app?.config?.globalProperties?.$pinia;
            pinia?._s?.get('selection')?.setPhaseEditing(false);
        });
        const cellBox = await cell.boundingBox();
        if (!cellBox) throw new Error('LTN cell bounding box not found');
        await page.mouse.click(cellBox.x + 25, cellBox.y + 10);
        await page
            .locator('.leaflet-filters-pane path.modal-filter-marker')
            .first()
            .dispatchEvent('click');

        await expect(page.locator('.leaflet-popup.feature-popup-editor')).toHaveCount(0);
        await expect(page.getByText(/features? selected/)).toHaveCount(0);
        await expect(cell).toBeVisible();
        await expect(cell).toHaveAttribute('stroke', '#0088aa');
        await expect(cell).toHaveAttribute('fill', '#0088aa');
        await expect(cell).toHaveAttribute('stroke-opacity', '0.28');
        expect(Number(await cell.getAttribute('fill-opacity'))).toBeCloseTo(0.056);
        await expect(cell).toHaveCSS('opacity', '1');
    });
});

test.describe('Groups — Version-specific LTN cells', () => {
    test.beforeEach(async ({ page, context }) => {
        await setupPage(page, context);
        await placeTwoModalFilters(page, 90);
        await selectBothFilters(page);
        await createGroup(page, 'Versioned LTN');
        await openGroupsPanel(page);
        await openGroupDetails(page, 'Versioned LTN');
        await createGroupVersion(page, 'Alternative');
        const detailsDialog = page.getByRole('dialog', { name: 'Group details' });
        if (await detailsDialog.isVisible()) {
            await detailsDialog.getByRole('button', { name: 'Close group details' }).click();
        }
    });

    test('hides the cell title and excludes the cell from selection in other versions', async ({
        page
    }) => {
        const closeGroupsButton = page.getByRole('button', { name: 'Close groups panel' });
        if (await closeGroupsButton.isVisible()) {
            await closeGroupsButton.click();
        }
        await drawNamedLtnCell(page, 'New cell');
        await expect(page.getByText('New cell', { exact: true })).toBeVisible();

        await openGroupsPanel(page);
        await openGroupDetails(page, 'Versioned LTN');
        await page
            .locator('.leaflet-ltns-pane path.ltn-cell.leaflet-interactive')
            .dispatchEvent('click');
        await page.getByRole('button', { name: 'Close group details' }).click();

        await openGroupsPanel(page);
        await openGroupDetails(page, 'Versioned LTN');
        await page.getByRole('button', { name: 'Select version Default' }).click();
        await page.waitForTimeout(300);

        const cellPath = page.locator('.leaflet-ltns-pane path.ltn-cell.leaflet-interactive');
        await expect(cellPath).toHaveAttribute('stroke-opacity', '0');
        await expect(cellPath).toHaveAttribute('fill-opacity', '0');
        await expect(cellPath).toHaveCSS('pointer-events', 'none');
        await expect(page.getByText('New cell', { exact: true })).not.toBeVisible();

        const finalCloseGroupsButton = page.getByRole('button', { name: 'Close groups panel' });
        if (await finalCloseGroupsButton.isVisible()) {
            await finalCloseGroupsButton.click();
        }
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
