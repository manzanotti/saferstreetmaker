import { expect, type Page } from '@playwright/test';

export function probeSvgPath(element: Element, mode: string) {
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
    const offsets =
        mode === 'stroke'
            ? [
                  { x: -2, y: 0 },
                  { x: 2, y: 0 },
                  { x: 0, y: -2 },
                  { x: 0, y: 2 },
                  { x: -3, y: 0 },
                  { x: 3, y: 0 },
                  { x: 0, y: -3 },
                  { x: 0, y: 3 }
              ]
            : [
                  { x: 0, y: 0 },
                  { x: -2, y: 0 },
                  { x: 2, y: 0 },
                  { x: 0, y: -2 },
                  { x: 0, y: 2 }
              ];

    for (const distance of distances) {
        for (const offset of offsets) {
            const point = toScreenPoint(distance, offset.x, offset.y);
            const hit = document.elementFromPoint(point.x, point.y);
            if (
                mode === 'stroke'
                    ? hit === path
                    : document.elementsFromPoint(point.x, point.y).includes(path)
            ) {
                return { ...point, cursor: hit ? getComputedStyle(hit).cursor : null };
            }
        }
    }

    if (mode === 'stroke') {
        throw new Error('No path stroke point found');
    }

    const point = toScreenPoint(length / 2, 0, 0);
    const hit = document.elementFromPoint(point.x, point.y);
    return { ...point, cursor: hit ? getComputedStyle(hit).cursor : null };
}

export async function hoverSvgPath(
    page: Page,
    locator: ReturnType<Page['locator']>
): Promise<void> {
    const point = await locator.first().evaluate(probeSvgPath, 'path');

    await page.mouse.move(point.x, point.y);
    await page.waitForTimeout(100);
}

export async function clickSvgPath(
    page: Page,
    locator: ReturnType<Page['locator']>
): Promise<void> {
    const point = await locator.first().evaluate(probeSvgPath, 'path');

    await page.mouse.click(point.x, point.y);
    await page.waitForTimeout(200);
}

export async function dragFirstEditHandle(
    page: Page,
    offsetX: number,
    offsetY: number
): Promise<void> {
    const handle = page.locator('.leaflet-editing-icon').first();
    await expect(handle).toBeVisible();

    const box = await handle.boundingBox();
    if (!box) {
        throw new Error('Edit handle bounding box not found');
    }

    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + offsetX, startY + offsetY, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(500);
}

export async function hoverSvgPathStroke(
    page: Page,
    locator: ReturnType<Page['locator']>
): Promise<void> {
    const point = await locator.first().evaluate(probeSvgPath, 'stroke');

    await page.mouse.move(point.x, point.y);
    await page.waitForTimeout(100);
}
