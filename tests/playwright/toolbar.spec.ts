import { test, expect } from '@playwright/test';

test.describe('Toolbar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
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
    // Start from a clean default state so all layers (and therefore the group
    // members) are active and the submenus exist.
    await page.addInitScript(() => window.localStorage.clear());
    await page.goto('/');
    await page.waitForSelector('.toolbar');
  });

  test('selecting a different filters-group member keeps the group in place', async ({ page }) => {
    const members = ['modal-filter-button', 'bus-gate-button'];

    // Default: the group's button is the first member (modal filters).
    await expect(page.locator('#modal-filter-button')).toBeVisible();
    const indexBefore = await page.evaluate(groupIndex(members));

    // Reveal the submenu and pick the other member (bus gates).
    await page.locator('#modal-filter-button').click({ button: 'right' });
    await page.locator('#bus-gate-button').click();

    // Toolbar redraws asynchronously (PubSub); wait for bus gates to become
    // the collapsed group button.
    await page.waitForFunction(() => {
      const toolbar = document.querySelector('.toolbar');
      if (!toolbar) return false;
      const li = Array.from(toolbar.children).find((c) =>
        c.querySelector(':scope > #bus-gate-button')
      );
      return li !== undefined;
    });

    const indexAfter = await page.evaluate(groupIndex(members));
    expect(indexAfter).toBe(indexBefore);
  });

  test('selecting a different traffic-controls-group member keeps the group in place', async ({ page }) => {
    const members = ['traffic-lights-button', 'pedestrian-lights-button', 'zebra-crossing-button'];

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
});
