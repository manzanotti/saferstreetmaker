import { test, expect } from '@playwright/test';

test.describe('Help Panel', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('.toolbar');
    });

    test('help modal is hidden on load', async ({ page }) => {
        const helpModal = page.locator('#help');
        await expect(helpModal).not.toBeVisible();
    });

    test('clicking help button shows the help modal', async ({ page }) => {
        await page.locator('#help-button').click();
        const helpModal = page.locator('#help');
        await expect(helpModal).toBeVisible();
    });

    test('clicking help button a second time hides the help modal', async ({ page }) => {
        const helpButton = page.locator('#help-button');
        await helpButton.click(); // open
        await helpButton.click(); // close
        const helpModal = page.locator('#help');
        await expect(helpModal).not.toBeVisible();
    });

    test('help modal contains welcome text', async ({ page }) => {
        await page.locator('#help-button').click();
        await expect(page.locator('#tabs-home')).toContainText('Welcome to the Safer Street Maker');
    });

    test('clicking a tab switches the visible panel', async ({ page }) => {
        await page.locator('#help-button').click();

        // The Welcome panel is shown by default; the Features panel is hidden.
        await expect(page.locator('#tabs-home')).toBeVisible();
        await expect(page.locator('#tabs-features')).not.toBeVisible();

        await page.locator('a[data-tab-target="#tabs-features"]').click();

        await expect(page.locator('#tabs-features')).toBeVisible();
        await expect(page.locator('#tabs-home')).not.toBeVisible();
    });

    test('Features tab documents Bus Lanes', async ({ page }) => {
        await page.locator('#help-button').click();
        await page.locator('a[data-tab-target="#tabs-features"]').click();

        const busLanesHeading = page.locator('#tabs-features h2').filter({ hasText: 'Bus Lanes' });
        await expect(busLanesHeading).toBeVisible();
        await expect(busLanesHeading.locator('img')).toHaveAttribute('src', /bus-lane\.svg/);
        await expect(page.locator('#tabs-features')).toContainText(
            'right-click or hold the currently visible Tram or Bus Lane button'
        );
        await expect(page.locator('#tabs-features')).toContainText('select the Bus Lane button');
    });

    test('Groups and Layers tabs appear before Maps with guidance', async ({ page }) => {
        await page.locator('#help-button').click();

        const tabs = page.locator('[data-tab-nav] [role="presentation"]');
        await expect(tabs.nth(1)).toContainText('Features');
        await expect(tabs.nth(2)).toContainText('Groups');
        await expect(tabs.nth(3)).toContainText('Layers');
        await expect(tabs.nth(4)).toContainText('Maps');

        await page.locator('a[data-tab-target="#tabs-groups"]').click();

        await expect(page.locator('#tabs-groups')).toBeVisible();
        await expect(page.locator('#tabs-groups')).toContainText('Group versions');
        await expect(page.locator('#tabs-groups')).toContainText(
            'Select a version to switch designs'
        );
        await expect(page.locator('#tabs-groups')).toContainText(
            'The selected version and unassigned group features are shown on the map'
        );
        await expect(page.locator('#tabs-groups')).toContainText('all LTN cells in the group');
        await expect(page.locator('#tabs-groups')).toContainText('striped pattern');
        await expect(page.locator('#tabs-groups')).toContainText('Group phases');
        await expect(page.locator('#tabs-groups')).toContainText('New phase');
        await expect(page.locator('#tabs-groups')).toContainText('ordered sequence');
        await expect(page.locator('#tabs-groups')).toContainText('dragging them in the list');

        await page.locator('a[data-tab-target="#tabs-layers"]').click();
        await expect(page.locator('#tabs-layers')).toBeVisible();
        await expect(page.locator('#tabs-layers')).toContainText('Add layer');
        await expect(page.locator('#tabs-layers')).toContainText('overlapping squares button');
        await expect(page.locator('#tabs-layers')).toContainText('Birmingham Council wards');
        await expect(page.locator('#tabs-layers')).toContainText('example');
        await expect(page.locator('#tabs-layers')).toContainText('Presentation mode');
    });

    test('Sharing tab explains group and version links', async ({ page }) => {
        await page.locator('#help-button').click();
        await page.locator('a[data-tab-target="#tabs-sharing"]').click();

        await expect(page.locator('#tabs-sharing')).toContainText('identifies the group');
        await expect(page.locator('#tabs-sharing')).toContainText('active version number');
        await expect(page.locator('#tabs-sharing')).toContainText('Presentation mode');
        await expect(page.locator('#tabs-sharing')).toContainText('implementation phases');
    });

    test('Keyboard shortcuts tab documents map, editing, and contextual shortcuts', async ({
        page
    }) => {
        await page.locator('#help-button').click();
        await page.getByRole('tab', { name: 'Keyboard shortcuts' }).click();
        const shortcuts = page.getByRole('tabpanel', { name: 'Keyboard shortcuts' });
        await expect(shortcuts).toBeVisible();
        for (const shortcut of [
            'P',
            'S',
            'G',
            'L',
            'Delete / Backspace',
            'Ctrl/Command + Z',
            'Ctrl/Command + Y',
            'Ctrl/Command + Shift + Z',
            'Ctrl/Command + C',
            'Ctrl/Command + V',
            'Ctrl/Command + I',
            'Arrow keys',
            '+ / -',
            'Escape',
            'Arrow Up / Arrow Down on a phase row',
            'Tab / Shift + Tab'
        ]) {
            await expect(
                shortcuts.locator('strong').getByText(shortcut, { exact: true })
            ).toBeVisible();
        }
        await expect(shortcuts).toContainText('toggle Presentation mode on or off');
        await expect(shortcuts).toContainText('while typing in a text field');
        await page.getByRole('tab', { name: 'Settings', exact: true }).click();
        await expect(page.locator('#tabs-settings')).toContainText('Presentation mode');
        await expect(page.locator('#help')).not.toContainText(/read.only/i);
    });

    test('clicking the help modal close button hides the modal', async ({ page }) => {
        await page.locator('#help-button').click();
        const closeButton = page.getByRole('button', { name: 'Close help panel' });
        const hitArea = await closeButton.evaluate((element) => {
            const { width, height } = element.getBoundingClientRect();
            return { width, height };
        });
        expect(hitArea.width).toBeGreaterThanOrEqual(44);
        expect(hitArea.height).toBeGreaterThanOrEqual(44);
        await closeButton.click();

        await expect(page.locator('#help')).not.toBeVisible();
    });

    test('pressing Escape closes the help modal', async ({ page }) => {
        await page.locator('#help-button').click();
        await page.getByRole('button', { name: 'Close help panel' }).focus();
        await page.keyboard.press('Escape');

        await expect(page.locator('#help')).not.toBeVisible();
        await expect(page.locator('#help-button')).toBeFocused();
    });

    test('opening another modal closes the help popup first', async ({ page }) => {
        await page.locator('#help-button').click();
        await expect(page.locator('#help')).toBeVisible();

        await page.locator('#settings-button').click();

        await expect(page.locator('#help')).not.toBeVisible();
        await expect(page.locator('#read-only')).toBeVisible();
    });

    test('opening help while another modal is open closes that modal and clears its selected button', async ({
        page
    }) => {
        await page.locator('#settings-button').click();
        await expect(page.locator('#read-only')).toBeVisible();
        await expect(page.locator('#settings-button')).toHaveAttribute('aria-pressed', 'true');

        await page.locator('#help-button').click();

        await expect(page.locator('#help')).toBeVisible();
        await expect(page.locator('#read-only')).not.toBeVisible();
        await expect(page.locator('#settings-button')).toHaveAttribute('aria-pressed', 'false');
    });
});
