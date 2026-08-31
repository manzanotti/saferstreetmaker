import { test, expect } from '@playwright/test';
import { addFreshStorageInitScript, waitForFreshStorage } from './indexedDbHelpers';

test.describe('Toolbar', () => {
    test.beforeEach(async ({ page }) => {
        await addFreshStorageInitScript(page);
        await page.goto('/');
        await waitForFreshStorage(page);
        // Wait for the toolbar to be rendered by Leaflet
        await page.waitForSelector('.toolbar');
    });

    test('toolbar is visible', async ({ page }) => {
        await expect(page.locator('.toolbar')).toBeVisible();
    });

    test('help button is present', async ({ page }) => {
        await expect(page.locator('#help-button')).toBeVisible();
    });

    test('settings button is present', async ({ page }) => {
        await expect(page.locator('#settings-button')).toBeVisible();
    });

    test('map manager button is present', async ({ page }) => {
        await expect(page.locator('#map-manager-button')).toBeVisible();
    });

    test('undo and redo buttons are present', async ({ page }) => {
        await expect(page.locator('#undo-button')).toBeVisible();
        await expect(page.locator('#redo-button')).toBeVisible();
    });

    test('share button is present', async ({ page }) => {
        await expect(page.locator('#share-button')).toBeVisible();
    });

    test('modal filter layer button is present', async ({ page }) => {
        await expect(page.locator('#modal-filter-button')).toBeVisible();
    });

    test('mobility lane button is present', async ({ page }) => {
        await expect(page.locator('#mobility-lane-button')).toBeVisible();
    });

    test('car free street button is present', async ({ page }) => {
        await expect(page.locator('#car-free-street-button')).toBeVisible();
    });

    test('school street button is present', async ({ page }) => {
        await expect(page.locator('#school-street-button')).toBeVisible();
    });
});

test.describe('Toolbar button groups', () => {
    // Returns the index, among the toolbar's top-level <li> elements, of the
    // group whose collapsed button is currently any of the given member ids.
    const groupIndex = (memberIds: Array<string>) =>
        `(() => {
      const toolbar = document.querySelector('.toolbar');
      const lis = Array.from(toolbar.children);
      return lis.findIndex((li) =>
        ${JSON.stringify(memberIds)}.some((id) => li.querySelector('#' + id))
      );
    })()`;

    test.beforeEach(async ({ page }) => {
        await addFreshStorageInitScript(page);
        await page.goto('/');
        await waitForFreshStorage(page);
        await page.waitForSelector('.toolbar');
    });

    test('selecting a different filters-group member keeps the group in place', async ({
        page
    }) => {
        const members = ['modal-filter-button', 'bus-gate-button'];

        // Default: the group's button is the first member (modal filters).
        await expect(page.locator('#modal-filter-button')).toBeVisible();
        const indexBefore = await page.evaluate(groupIndex(members));

        // Reveal the submenu and pick the other member (bus gates).
        await page.locator('#modal-filter-button').click({ button: 'right' });
        await page.locator('#bus-gate-button').click();

        // Toolbar re-renders reactively via Pinia; wait for bus gates to become
        // the collapsed group button.
        await page.waitForFunction(() => {
            const toolbar = document.querySelector('.toolbar');
            if (!toolbar) return false;
            const li = Array.from(toolbar.children).find((c) =>
                c.querySelector(':scope > #bus-gate-button')
            );
            return li !== undefined;
        });

        await expect(
            page
                .locator('.toolbar > li.group')
                .filter({ has: page.locator(':scope > #bus-gate-button') })
        ).toHaveCount(1);
        await expect(
            page
                .locator('.toolbar > li.group')
                .filter({ has: page.locator(':scope > #bus-gate-button') })
                .locator('.subToolbar')
        ).toBeHidden();

        const indexAfter = await page.evaluate(groupIndex(members));
        expect(indexAfter).toBe(indexBefore);
    });

    test('selecting a different traffic-controls-group member keeps the group in place', async ({
        page
    }) => {
        const members = [
            'traffic-lights-button',
            'pedestrian-lights-button',
            'zebra-crossing-button'
        ];

        await expect(page.locator('#traffic-lights-button')).toBeVisible();
        const indexBefore = await page.evaluate(groupIndex(members));

        await page.locator('#traffic-lights-button').click({ button: 'right' });
        await page.locator('#zebra-crossing-button').click();

        await page.waitForFunction(() => {
            const toolbar = document.querySelector('.toolbar');
            if (!toolbar) return false;
            const li = Array.from(toolbar.children).find((c) =>
                c.querySelector(':scope > #zebra-crossing-button')
            );
            return li !== undefined;
        });

        const indexAfter = await page.evaluate(groupIndex(members));
        expect(indexAfter).toBe(indexBefore);
    });

    test('Tram Lines is a single toolbar item when Bus Lanes is disabled', async ({ page }) => {
        await page.locator('#settings-button').click();
        await page.locator('#BusLanes').uncheck();
        await page.locator('button:has-text("Save")').click();

        const tramButton = page.locator('#tram-line-button');
        await expect(tramButton).toBeVisible();
        await expect(tramButton).not.toHaveAttribute('aria-expanded');
        await expect(tramButton.locator('xpath=ancestor::li')).not.toHaveClass(/group/);
        await expect(page.locator('#bus-lane-button')).not.toBeVisible();
    });

    test('Bus Lanes is a single toolbar item when Tram Lines is disabled', async ({ page }) => {
        await page.locator('#settings-button').click();
        await page.locator('#TramLines').uncheck();
        await page.locator('button:has-text("Save")').click();

        const busButton = page.locator('#bus-lane-button');
        await expect(busButton).toBeVisible();
        await expect(busButton).not.toHaveAttribute('aria-expanded');
        await expect(busButton.locator('xpath=ancestor::li')).not.toHaveClass(/group/);
        await expect(page.locator('#tram-line-button')).not.toBeVisible();
    });
});

test.describe('Toolbar sub-group collapse', () => {
    test.beforeEach(async ({ page }) => {
        await addFreshStorageInitScript(page);
        await page.goto('/');
        await waitForFreshStorage(page);
        await page.waitForSelector('.toolbar');
        await page.addStyleTag({ content: '#help { display: none !important; }' });
    });

    function filtersGroupSubmenu(page: import('@playwright/test').Page) {
        const group = page
            .locator('.toolbar > li.group')
            .filter({ has: page.locator(':scope > #modal-filter-button') });
        return group.locator('.subToolbar');
    }

    test('pressing Escape collapses an expanded button sub-group', async ({ page }) => {
        await page.locator('#modal-filter-button').click({ button: 'right' });
        const submenu = filtersGroupSubmenu(page);
        await expect(submenu).toBeVisible();

        await page.keyboard.press('Escape');
        await expect(submenu).toBeHidden();
    });

    test('clicking the map collapses an expanded button sub-group', async ({ page }) => {
        await page.locator('#modal-filter-button').click({ button: 'right' });
        const submenu = filtersGroupSubmenu(page);
        await expect(submenu).toBeVisible();

        const map = page.locator('.leaflet-container');
        const box = await map.boundingBox();
        if (!box) throw new Error('Map bounding box not found');
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

        await expect(submenu).toBeHidden();
    });
});

test.describe('hide-toolbar URL parameter', () => {
    test('toolbar is hidden when hide-toolbar=true is in the URL', async ({ page }) => {
        await page.goto('/?hide-toolbar=true');
        // The Leaflet map container should appear without a toolbar
        await page.waitForSelector('#map');
        await page.waitForTimeout(500); // allow map + settings to initialise
        await expect(page.locator('.toolbar')).not.toBeAttached();
    });

    test('toolbar is visible when hide-toolbar is absent', async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('.toolbar');
        await expect(page.locator('.toolbar')).toBeVisible();
    });
});
