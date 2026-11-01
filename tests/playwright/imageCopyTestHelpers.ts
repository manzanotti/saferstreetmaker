import type { BrowserContext, Page } from '@playwright/test';
import { addFreshStorageInitScript, waitForFreshStorage } from './indexedDbHelpers';
import { createTilePng, setTileResponse } from './imageExportTestHelpers';
import { waitForMapReady } from './layers/layerMapTestHelpers';

export type TestRoot = HTMLElement & {
    __vue_app__?: {
        config: {
            globalProperties: {
                $pinia: {
                    _s: Map<
                        string,
                        {
                            map?: import('leaflet').Map;
                            selected?: Array<{ latLng: import('leaflet').LatLng }>;
                            imageExportInProgress?: boolean;
                        }
                    >;
                };
            };
        };
    };
};

export async function setupImageCopyTest(
    page: Page,
    context: BrowserContext,
    grantClipboard = true
) {
    await context.grantPermissions(
        grantClipboard ? ['geolocation', 'clipboard-read', 'clipboard-write'] : ['geolocation']
    );
    await context.setGeolocation({ latitude: 52.5, longitude: -1.9 });
    await addFreshStorageInitScript(page);
    await setTileResponse(page, await createTilePng(page));
    await page.goto('/');
    await waitForFreshStorage(page);
    const closeHelp = page.getByRole('button', { name: 'Close help panel' });
    if (await closeHelp.isVisible()) {
        await closeHelp.click();
    }
    await page.addStyleTag({ content: '#help { display: none !important; }' });
    await page.addStyleTag({ content: '.leaflet-tile { opacity: 1 !important; }' });
    await page.waitForSelector('.toolbar');
    await waitForMapReady(page);
}

export async function compareClipboardWithPng(page: Page, base64: string) {
    return await page.evaluate(async (fileBase64) => {
        const items = await navigator.clipboard.read();
        const item = items.find((entry) => entry.types.includes('image/png'));
        if (!item) {
            throw new Error('The clipboard did not contain a PNG');
        }
        const clipboardBlob = await item.getType('image/png');
        const signature = Array.from(new Uint8Array(await clipboardBlob.arrayBuffer()).slice(0, 8));
        const fileBlob = await (await fetch(`data:image/png;base64,${fileBase64}`)).blob();
        const [copied, saved] = await Promise.all([
            createImageBitmap(clipboardBlob),
            createImageBitmap(fileBlob)
        ]);
        const canvas = document.createElement('canvas');
        canvas.width = copied.width;
        canvas.height = copied.height;
        const context = canvas.getContext('2d');
        if (!context) {
            throw new Error('Canvas unavailable');
        }
        context.drawImage(copied, 0, 0);
        const copiedPixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(saved, 0, 0);
        const savedPixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let differentPixels = 0;
        for (let index = 0; index < copiedPixels.length; index += 4) {
            if (
                copiedPixels[index] !== savedPixels[index] ||
                copiedPixels[index + 1] !== savedPixels[index + 1] ||
                copiedPixels[index + 2] !== savedPixels[index + 2] ||
                copiedPixels[index + 3] !== savedPixels[index + 3]
            ) {
                differentPixels++;
            }
        }
        return {
            signature,
            width: copied.width,
            height: copied.height,
            fileWidth: saved.width,
            fileHeight: saved.height,
            differentPixels
        };
    }, base64);
}
