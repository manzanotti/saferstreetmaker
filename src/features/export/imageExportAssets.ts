import type * as L from 'leaflet';

export function waitForExportFrame(): Promise<void> {
    if (document.visibilityState === 'hidden') {
        return Promise.resolve();
    }

    return new Promise((resolve) => {
        let frameId: number | undefined;
        let timeoutId: number | undefined;
        const cleanup = () => {
            if (frameId !== undefined) {
                window.cancelAnimationFrame(frameId);
            }
            if (timeoutId !== undefined) {
                window.clearTimeout(timeoutId);
            }
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
        const finish = () => {
            cleanup();
            resolve();
        };
        const onVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                finish();
            }
        };

        document.addEventListener('visibilitychange', onVisibilityChange);
        frameId = window.requestAnimationFrame(finish);
        timeoutId = window.setTimeout(finish, 1000);
    });
}

export async function settleMapViewForExport(map: L.Map): Promise<void> {
    // Leaflet starts CSS zoom transitions on the next animation frame.
    await waitForExportFrame();
    await waitForExportFrame();
    const deadline = Date.now() + 5000;
    while (map.getContainer().querySelector('.leaflet-zoom-anim')) {
        if (Date.now() >= deadline) {
            throw new Error(
                'The map is still zooming. Wait for it to finish and try exporting again.'
            );
        }
        await new Promise<void>((resolve) => window.setTimeout(resolve, 25));
    }
    map.stop();
}

function intersects(a: DOMRect, b: DOMRect): boolean {
    return a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom;
}

async function waitForImage(image: HTMLImageElement, signal: AbortSignal): Promise<void> {
    if (image.complete) {
        if (image.naturalWidth === 0) {
            throw new Error('A map image did not load. Check your connection and try again.');
        }
        return;
    }

    await new Promise<void>((resolve, reject) => {
        const onLoad = () => {
            cleanup();
            image.naturalWidth > 0
                ? resolve()
                : reject(
                      new Error('A map image did not load. Check your connection and try again.')
                  );
        };
        const onError = () => {
            cleanup();
            reject(new Error('A map image did not load. Check your connection and try again.'));
        };
        const cleanup = () => {
            image.removeEventListener('load', onLoad);
            image.removeEventListener('error', onError);
            signal.removeEventListener('abort', cleanup);
        };
        image.addEventListener('load', onLoad, { once: true });
        image.addEventListener('error', onError, { once: true });
        signal.addEventListener('abort', cleanup, { once: true });
    });
}

export async function waitForMapAssets(mapElement: HTMLElement): Promise<void> {
    await document.fonts?.ready;
    const mapRect = mapElement.getBoundingClientRect();
    const images = [...mapElement.querySelectorAll('img')].filter((image) => {
        const control = image.closest('.leaflet-control');
        const controlIsExported =
            !control ||
            control.classList.contains('leaflet-control-attribution') ||
            Boolean(image.closest('[data-image-export-legend]'));
        return controlIsExported && intersects(image.getBoundingClientRect(), mapRect);
    });
    const timeoutController = new AbortController();
    let timeoutId: number | undefined;

    try {
        await Promise.race([
            Promise.all(images.map((image) => waitForImage(image, timeoutController.signal))),
            new Promise<never>((_, reject) => {
                timeoutId = window.setTimeout(
                    () =>
                        reject(new Error('Map images took too long to load. Try exporting again.')),
                    20_000
                );
            })
        ]);
    } finally {
        if (timeoutId !== undefined) {
            window.clearTimeout(timeoutId);
        }
        timeoutController.abort();
    }
}

export function removeMapControlsFromClone(clonedDocument: Document): void {
    const mapElement = clonedDocument.querySelector('#map');
    if (!mapElement) {
        throw new Error('The map could not be prepared for image export.');
    }

    for (const control of mapElement.querySelectorAll<HTMLElement>('.leaflet-control')) {
        if (
            control.classList.contains('leaflet-control-attribution') ||
            control.querySelector('[data-image-export-legend]')
        ) {
            continue;
        }
        control.remove();
    }

    for (const selector of [
        '.leaflet-popup-pane',
        '.leaflet-draw-tooltip',
        '.leaflet-draw-actions',
        '.leaflet-draw-guide-dash',
        '.leaflet-editing-icon',
        '.feature-name-editor'
    ]) {
        mapElement.querySelectorAll(selector).forEach((element) => element.remove());
    }
}

export function createPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
        try {
            canvas.toBlob((blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('The image could not be created. Try smaller dimensions.'));
                }
            }, 'image/png');
        } catch {
            reject(
                new Error(
                    'The map contains an image that cannot be exported. Check map image permissions and try again.'
                )
            );
        }
    });
}
