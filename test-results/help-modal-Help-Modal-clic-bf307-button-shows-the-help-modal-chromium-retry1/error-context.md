# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: help-modal.spec.ts >> Help Modal >> clicking help button shows the help modal
- Location: tests/playwright/help-modal.spec.ts:14:9

# Error details

```
Test timeout of 30000ms exceeded while running "beforeEach" hook.
```

```
Error: page.waitForSelector: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('.toolbar') to be visible

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Help Modal', () => {
  4  |     test.beforeEach(async ({ page }) => {
  5  |         await page.goto('/');
> 6  |         await page.waitForSelector('.toolbar');
     |                    ^ Error: page.waitForSelector: Test timeout of 30000ms exceeded.
  7  |     });
  8  | 
  9  |     test('help modal is hidden on load', async ({ page }) => {
  10 |         const helpModal = page.locator('#help');
  11 |         await expect(helpModal).not.toBeVisible();
  12 |     });
  13 | 
  14 |     test('clicking help button shows the help modal', async ({ page }) => {
  15 |         await page.locator('#help-button').click();
  16 |         const helpModal = page.locator('#help');
  17 |         await expect(helpModal).toBeVisible();
  18 |     });
  19 | 
  20 |     test('clicking help button a second time hides the help modal', async ({ page }) => {
  21 |         const helpButton = page.locator('#help-button');
  22 |         await helpButton.click(); // open
  23 |         await helpButton.click(); // close
  24 |         const helpModal = page.locator('#help');
  25 |         await expect(helpModal).not.toBeVisible();
  26 |     });
  27 | 
  28 |     test('help modal contains welcome text', async ({ page }) => {
  29 |         await page.locator('#help-button').click();
  30 |         await expect(page.locator('#tabs-home')).toContainText('Welcome to the Safer Street Maker');
  31 |     });
  32 | 
  33 |     test('clicking a tab switches the visible panel', async ({ page }) => {
  34 |         await page.locator('#help-button').click();
  35 | 
  36 |         // The Welcome panel is shown by default; the Features panel is hidden.
  37 |         await expect(page.locator('#tabs-home')).toBeVisible();
  38 |         await expect(page.locator('#tabs-features')).not.toBeVisible();
  39 | 
  40 |         await page.locator('a[data-tab-target="#tabs-features"]').click();
  41 | 
  42 |         await expect(page.locator('#tabs-features')).toBeVisible();
  43 |         await expect(page.locator('#tabs-home')).not.toBeVisible();
  44 |     });
  45 | 
  46 |     test('clicking the help modal close button hides the modal', async ({ page }) => {
  47 |         await page.locator('#help-button').click();
  48 |         await page.locator('button[name="closeHelp"]').first().click();
  49 | 
  50 |         await expect(page.locator('#help')).not.toBeVisible();
  51 |     });
  52 | 
  53 |     test('opening another modal closes the help popup first', async ({ page }) => {
  54 |         await page.locator('#help-button').click();
  55 |         await expect(page.locator('#help')).toBeVisible();
  56 | 
  57 |         await page.locator('#settings-button').click();
  58 | 
  59 |         await expect(page.locator('#help')).not.toBeVisible();
  60 |         await expect(page.locator('#read-only')).toBeVisible();
  61 |     });
  62 | 
  63 |     test('opening help while another modal is open closes that modal and clears its selected button', async ({
  64 |         page
  65 |     }) => {
  66 |         await page.locator('#settings-button').click();
  67 |         await expect(page.locator('#read-only')).toBeVisible();
  68 |         await expect(page.locator('#settings-button')).toHaveAttribute('aria-pressed', 'true');
  69 | 
  70 |         await page.locator('#help-button').click();
  71 | 
  72 |         await expect(page.locator('#help')).toBeVisible();
  73 |         await expect(page.locator('#read-only')).not.toBeVisible();
  74 |         await expect(page.locator('#settings-button')).toHaveAttribute('aria-pressed', 'false');
  75 |     });
  76 | });
  77 | 
```