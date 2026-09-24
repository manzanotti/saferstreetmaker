import type { Page } from '@playwright/test';

export async function hoverLocatorCenter(
    page: Page,
    locator: ReturnType<Page['locator']>
): Promise<void> {
    const box = await locator.first().boundingBox();
    if (!box) {
        throw new Error('Hovered element bounding box unavailable');
    }

    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await page.mouse.move(point.x, point.y);
    await page.waitForTimeout(100);
}
