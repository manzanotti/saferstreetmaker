import type * as L from 'leaflet';
import { nextTick } from 'vue';
import { applySelectionHighlights } from '../selection/featureSelection';
import { pinia } from '../../stores/index';
import { useMapStore } from '../../stores/mapStore';
import { useSelectionStore } from '../../stores/selectionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useUiStore } from '../../stores/uiStore';
import { getVisibleLegendLayers } from './visibleLegendLayers';

export const MIN_IMAGE_EXPORT_DIMENSION = 256;
export const MAX_IMAGE_EXPORT_DIMENSION = 8192;
export const MAX_IMAGE_EXPORT_PIXELS = 16_777_216;

const LEGEND_BOUNDS_TOLERANCE = 1;

let exportInProgress = false;

export function getImageExportValidationError(
    width: number | null,
    height: number | null
): string | null {
    if (width === null || height === null || !Number.isFinite(width) || !Number.isFinite(height)) {
        return 'Enter a width and height in pixels.';
    }
    if (!Number.isInteger(width) || !Number.isInteger(height)) {
        return 'Width and height must be whole numbers.';
    }
    if (
        width < MIN_IMAGE_EXPORT_DIMENSION ||
        height < MIN_IMAGE_EXPORT_DIMENSION ||
        width > MAX_IMAGE_EXPORT_DIMENSION ||
        height > MAX_IMAGE_EXPORT_DIMENSION
    ) {
        return `Choose dimensions between ${MIN_IMAGE_EXPORT_DIMENSION} and ${MAX_IMAGE_EXPORT_DIMENSION} pixels.`;
    }
    if (width * height > MAX_IMAGE_EXPORT_PIXELS) {
        return 'The image is too large. Reduce its width or height.';
    }
    return null;
}

export function buildImageExportFilename(title: string): string {
    const safeTitle = title
        .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
        .replace(/[. ]+$/g, '')
        .trim();
    return `${safeTitle || 'map'}.png`;
}

function nextFrame(): Promise<void> {
    return new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
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

async function waitForMapAssets(mapElement: HTMLElement): Promise<void> {
    await document.fonts?.ready;
    const mapRect = mapElement.getBoundingClientRect();
    const images = [...mapElement.querySelectorAll('img')].filter((image) =>
        intersects(image.getBoundingClientRect(), mapRect)
    );
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

function removeMapControlsFromClone(clonedDocument: Document): void {
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

function createPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
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

function downloadBlob(blob: Blob, filename: string): void {
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.style.display = 'none';
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

export async function exportMapAsPng(width: number, height: number): Promise<void> {
    const validationError = getImageExportValidationError(width, height);
    if (validationError) {
        throw new Error(validationError);
    }
    if (exportInProgress) {
        throw new Error('An image export is already in progress.');
    }

    const mapStore = useMapStore(pinia);
    const selectionStore = useSelectionStore(pinia);
    const settingsStore = useSettingsStore(pinia);
    const uiStore = useUiStore(pinia);
    const map = mapStore.map;
    if (!map) {
        throw new Error('The map is not ready to export.');
    }
    if (mapStore.drawLayerId !== null || mapStore.activeLayerId !== null) {
        throw new Error('Finish or cancel the active map tool before exporting.');
    }

    const mapElement = map.getContainer();
    const originalStyle = mapElement.getAttribute('style');
    const originalAriaBusy = mapElement.getAttribute('aria-busy');
    const originalPointerEvents = mapElement.style.pointerEvents;
    const originalCenter = map.getCenter();
    const originalZoom = map.getZoom();
    const selectedFeatures = [...selectionStore.selected];
    let selectionCleared = false;
    exportInProgress = true;

    try {
        uiStore.setImageExportState(true, new Set());
        mapElement.setAttribute('aria-busy', 'true');
        mapElement.style.pointerEvents = 'none';

        if (selectedFeatures.length > 0) {
            applySelectionHighlights([], true, selectedFeatures);
            selectionCleared = true;
        }

        mapElement.style.width = `${width}px`;
        mapElement.style.height = `${height}px`;
        mapElement.style.setProperty('--image-export-width', `${width}px`);
        map.invalidateSize({ pan: false, debounceMoveend: true });
        await nextFrame();
        await nextFrame();

        const visibleLayers = getVisibleLegendLayers({
            map,
            layers: mapStore.layers,
            activeLayerIds: settingsStore.activeLayers,
            visibleLayerIds: mapStore.visibleLayerIds,
            legendLayerIds: uiStore.legendLayerIds
        });
        uiStore.setImageExportState(true, new Set(visibleLayers.map((layer) => layer.id)));
        await nextTick();
        await nextFrame();

        const legend = mapElement.querySelector<HTMLElement>('[data-image-export-legend]');
        if (legend) {
            const mapRect = mapElement.getBoundingClientRect();
            const legendRect = legend.getBoundingClientRect();
            if (
                legendRect.left < mapRect.left - LEGEND_BOUNDS_TOLERANCE ||
                legendRect.top < mapRect.top - LEGEND_BOUNDS_TOLERANCE ||
                legendRect.right > mapRect.right + LEGEND_BOUNDS_TOLERANCE ||
                legendRect.bottom > mapRect.bottom + LEGEND_BOUNDS_TOLERANCE
            ) {
                throw new Error('Increase the image dimensions to fit the complete legend.');
            }
        }

        await waitForMapAssets(mapElement);
        const { default: html2canvas } = await import('html2canvas-pro');
        const canvas = await html2canvas(mapElement, {
            allowTaint: false,
            backgroundColor: '#ffffff',
            height,
            imageTimeout: 20_000,
            logging: false,
            onclone: removeMapControlsFromClone,
            scale: 1,
            useCORS: true,
            width,
            windowHeight: Math.max(window.innerHeight, height),
            windowWidth: Math.max(window.innerWidth, width)
        });

        if (canvas.width !== width || canvas.height !== height) {
            throw new Error('The image was created at an unexpected size. Try exporting again.');
        }

        const blob = await createPngBlob(canvas);
        downloadBlob(blob, buildImageExportFilename(settingsStore.title));
    } finally {
        try {
            mapElement.style.pointerEvents = originalPointerEvents;
            if (originalStyle === null) {
                mapElement.removeAttribute('style');
            } else {
                mapElement.setAttribute('style', originalStyle);
            }
            if (originalAriaBusy === null) {
                mapElement.removeAttribute('aria-busy');
            } else {
                mapElement.setAttribute('aria-busy', originalAriaBusy);
            }
            map.invalidateSize({ pan: false, debounceMoveend: true });
            map.setView(originalCenter, originalZoom, { animate: false });
            if (selectionCleared) {
                applySelectionHighlights(selectedFeatures, true, []);
            }
        } finally {
            uiStore.setImageExportState(false, null);
            exportInProgress = false;
        }
    }
}
