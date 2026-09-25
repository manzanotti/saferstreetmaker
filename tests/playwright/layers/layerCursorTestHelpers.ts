import type { Page } from '@playwright/test';
import { probeSvgPath } from './layerSvgTestHelpers';

export async function getCursorAtPathPoint(locator: ReturnType<Page['locator']>): Promise<string> {
    const { cursor } = await locator.first().evaluate(probeSvgPath, 'path');
    if (cursor === null) {
        throw new Error('No element found at SVG path point');
    }
    return cursor;
}

export async function getCursorAtPathStroke(locator: ReturnType<Page['locator']>): Promise<string> {
    const { cursor } = await locator.first().evaluate(probeSvgPath, 'stroke');
    if (cursor === null) {
        throw new Error('No element found at SVG path stroke');
    }
    return cursor;
}

export async function getInlineCursor(locator: ReturnType<Page['locator']>): Promise<string> {
    return await locator.first().evaluate((element) => {
        if (!(element instanceof HTMLElement || element instanceof SVGElement)) {
            throw new Error('Element does not support inline cursor styles');
        }

        return element.style.cursor;
    });
}

export async function getCursorAtLocatorCenter(
    locator: ReturnType<Page['locator']>
): Promise<string> {
    return await locator.first().evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const hit = document.elementFromPoint(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2
        );
        if (!hit) {
            throw new Error('No element found at locator center point');
        }

        return getComputedStyle(hit).cursor;
    });
}

export async function getCursorAtPagePoint(page: Page, x: number, y: number): Promise<string> {
    return await page.evaluate(
        ({ pointX, pointY }) => {
            const hit = document.elementFromPoint(pointX, pointY);
            if (!hit) {
                throw new Error('No element found at page point');
            }

            return getComputedStyle(hit).cursor;
        },
        { pointX: x, pointY: y }
    );
}

export async function moveToMapOffset(
    page: Page,
    offsetX: number,
    offsetY: number
): Promise<{ x: number; y: number }> {
    const map = page.locator('.leaflet-container');
    const box = await map.boundingBox();
    if (!box) {
        throw new Error('Map bounding box not found');
    }

    const point = {
        x: box.x + box.width / 2 + offsetX,
        y: box.y + box.height / 2 + offsetY
    };
    await page.mouse.move(point.x, point.y);
    await page.waitForTimeout(100);

    return point;
}
