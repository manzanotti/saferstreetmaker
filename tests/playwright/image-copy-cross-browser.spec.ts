import { expect, test, type Page } from '@playwright/test';
import { setupImageCopyTest } from './imageCopyTestHelpers';

async function probeNativePngClipboard(page: Page): Promise<string | null> {
    await page.evaluate(async () => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 10;
        const context = canvas.getContext('2d');
        if (!context) {
            throw new Error('Canvas is unavailable');
        }
        context.fillStyle = '#ff0000';
        context.fillRect(0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob((value) => {
                if (value) {
                    resolve(value);
                } else {
                    reject(new Error('Could not create a PNG'));
                }
            });
        });
        const button = document.createElement('button');
        button.id = 'native-png-clipboard-probe';
        button.textContent = 'Test native PNG clipboard';
        button.style.cssText = 'position:fixed;z-index:20000;top:10px;left:10px';
        button.addEventListener('click', () => {
            button.dataset.result = 'pending';
            const item = new ClipboardItem({ 'image/png': blob });
            void navigator.clipboard.write([item]).then(
                () => {
                    button.dataset.result = 'success';
                },
                (error: unknown) => {
                    button.dataset.result = error instanceof Error ? error.name : String(error);
                }
            );
        });
        document.body.append(button);
    });

    const probe = page.locator('#native-png-clipboard-probe');
    await probe.click();
    await expect(probe).not.toHaveAttribute('data-result', 'pending', { timeout: 15_000 });
    const result = await probe.getAttribute('data-result');
    await probe.evaluate((button) => button.remove());
    return result;
}

test('copies PNGs or reports a native clipboard denial', async ({ page, context, browserName }) => {
    test.setTimeout(60_000);
    await setupImageCopyTest(page, context, false);

    let nativeClipboardDenied = false;
    if (browserName === 'webkit' && process.platform === 'win32') {
        // The Windows WebKit port may reject PNG writes even for a native canvas image.
        const nativeResult = await probeNativePngClipboard(page);
        expect(['success', 'NotAllowedError']).toContain(nativeResult);
        nativeClipboardDenied = nativeResult === 'NotAllowedError';
    }

    await page.locator('#share-button').click();
    await page.locator('#export-as-image').click();
    await page.locator('#width').fill('640');
    await page.locator('#height').fill('400');
    await page.getByRole('button', { name: 'Copy PNG' }).click();

    if (nativeClipboardDenied) {
        await expect(page.locator('#image-export-error')).toContainText(
            'Clipboard access was denied',
            { timeout: 20_000 }
        );
        await expect(page.locator('#map')).not.toHaveAttribute('aria-busy');
        await expect(page.locator('#image-copy-status')).toBeEmpty();

        await page.getByRole('button', { name: 'Close sharing panel' }).click();
        await page.locator('#map').focus();
        await page.keyboard.press('Control+i');
        await expect(page.getByRole('dialog', { name: 'An error has occurred' })).toContainText(
            'Clipboard access was denied',
            { timeout: 20_000 }
        );
        await expect(page.locator('#map')).not.toHaveAttribute('aria-busy');
        await expect(page.locator('#image-copy-status')).toBeEmpty();
        return;
    }

    await expect(page.locator('#image-copy-status')).toContainText(
        'Map image copied to clipboard.',
        { timeout: 20_000 }
    );
    await expect(page.locator('#map')).not.toHaveAttribute('aria-busy');

    await page.getByRole('button', { name: 'Close sharing panel' }).click();
    await expect(page.locator('#image-copy-status')).toBeEmpty({ timeout: 6000 });
    await page.locator('#map').focus();
    await page.keyboard.press('Control+i');
    await expect(page.locator('#image-copy-status')).toContainText(
        'Map image copied to clipboard.',
        { timeout: 20_000 }
    );
    await expect(page.locator('#map')).not.toHaveAttribute('aria-busy');
});
