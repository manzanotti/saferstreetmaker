import type { Page } from '@playwright/test';

export async function getCursorAtPathPoint(locator: ReturnType<Page['locator']>): Promise<string> {
    return await locator.first().evaluate((element) => {
        const path = element as SVGPathElement;
        const screenMatrix = path.getScreenCTM();

        if (!screenMatrix) {
            throw new Error('SVG path screen transform unavailable');
        }

        const toScreenPoint = (distance: number, offsetX: number, offsetY: number) => {
            const pointAtDistance = path.getPointAtLength(distance);
            return {
                x:
                    pointAtDistance.x * screenMatrix.a +
                    pointAtDistance.y * screenMatrix.c +
                    screenMatrix.e +
                    offsetX,
                y:
                    pointAtDistance.x * screenMatrix.b +
                    pointAtDistance.y * screenMatrix.d +
                    screenMatrix.f +
                    offsetY
            };
        };

        const length = path.getTotalLength();
        const distances = [0.25, 0.5, 0.75].map((fraction) => length * fraction);
        const offsets = [
            { x: 0, y: 0 },
            { x: -2, y: 0 },
            { x: 2, y: 0 },
            { x: 0, y: -2 },
            { x: 0, y: 2 }
        ];

        let hit: Element | null = null;

        for (const distance of distances) {
            for (const offset of offsets) {
                const point = toScreenPoint(distance, offset.x, offset.y);
                const stack = document.elementsFromPoint(point.x, point.y);
                if (stack.includes(path)) {
                    hit = document.elementFromPoint(point.x, point.y);
                    break;
                }
            }

            if (hit) {
                break;
            }
        }

        if (!hit) {
            const fallbackPoint = toScreenPoint(length / 2, 0, 0);
            hit = document.elementFromPoint(fallbackPoint.x, fallbackPoint.y);
        }

        if (!hit) {
            throw new Error('No element found at SVG path point');
        }

        return getComputedStyle(hit).cursor;
    });
}

export async function getCursorAtPathStroke(locator: ReturnType<Page['locator']>): Promise<string> {
    return await locator.first().evaluate((element) => {
        const path = element as SVGPathElement;
        const screenMatrix = path.getScreenCTM();

        if (!screenMatrix) {
            throw new Error('SVG path screen transform unavailable');
        }

        const toScreenPoint = (distance: number, offsetX: number, offsetY: number) => {
            const pointAtDistance = path.getPointAtLength(distance);
            return {
                x:
                    pointAtDistance.x * screenMatrix.a +
                    pointAtDistance.y * screenMatrix.c +
                    screenMatrix.e +
                    offsetX,
                y:
                    pointAtDistance.x * screenMatrix.b +
                    pointAtDistance.y * screenMatrix.d +
                    screenMatrix.f +
                    offsetY
            };
        };

        const length = path.getTotalLength();
        const distances = [0.25, 0.5, 0.75].map((fraction) => length * fraction);
        const offsets = [
            { x: -2, y: 0 },
            { x: 2, y: 0 },
            { x: 0, y: -2 },
            { x: 0, y: 2 },
            { x: -3, y: 0 },
            { x: 3, y: 0 },
            { x: 0, y: -3 },
            { x: 0, y: 3 }
        ];

        for (const distance of distances) {
            for (const offset of offsets) {
                const point = toScreenPoint(distance, offset.x, offset.y);
                const hit = document.elementFromPoint(point.x, point.y);
                if (hit === path) {
                    return getComputedStyle(hit).cursor;
                }
            }
        }

        throw new Error('No path stroke point found for cursor probe');
    });
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
