import * as L from 'leaflet';
import { nextTick } from 'vue';
import { applySelectionHighlights } from '../selection/featureSelection';
import { pinia } from '../../stores/index';
import { useMapStore } from '../../stores/mapStore';
import { useSelectionStore } from '../../stores/selectionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useUiStore } from '../../stores/uiStore';
import { getVisibleLegendLayers } from './visibleLegendLayers';

import {
    createPngBlob,
    removeMapControlsFromClone,
    settleMapViewForExport,
    waitForExportFrame,
    waitForMapAssets
} from './imageExportAssets';
import { getPngClipboardWriter } from './imageClipboard';
import { buildImageExportFilename, getImageExportValidationError } from './imageExportValidation';

export { waitForExportFrame, settleMapViewForExport } from './imageExportAssets';
export {
    buildImageExportFilename,
    getImageExportValidationError,
    MIN_IMAGE_EXPORT_DIMENSION,
    MAX_IMAGE_EXPORT_DIMENSION,
    MAX_IMAGE_EXPORT_PIXELS
} from './imageExportValidation';

const LEGEND_BOUNDS_TOLERANCE = 1;
let exportInProgress = false;

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

function revealSelectedGroupFeatures(mapElement: HTMLElement, features: L.Layer[]): () => void {
    if (!mapElement.classList.contains('point-features-hidden')) {
        return () => {};
    }

    const originalVisibility = new Map<HTMLElement | SVGElement, string>();
    for (const feature of features) {
        const layer = feature as L.Layer & {
            getElement?: () => HTMLElement | SVGElement | undefined;
        };
        const element = layer.getElement?.();
        if (!element || window.getComputedStyle(element).visibility !== 'hidden') {
            continue;
        }
        originalVisibility.set(element, element.style.visibility);
        element.style.visibility = 'visible';
    }

    return () => {
        for (const [element, visibility] of originalVisibility) {
            element.style.visibility = visibility;
        }
    };
}

function performImageExport(
    width: number,
    height: number,
    deliverImage: (image: Promise<Blob>) => Promise<void>
): Promise<void> {
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
    const originalInert = mapElement.inert;
    let originalCenter = map.getCenter();
    let originalZoom = map.getZoom();
    const selectedFeatures = [...selectionStore.selected];
    const isGroupSelection =
        selectionStore.isGroupSelection && selectionStore.selectedGroupId !== null;
    let restoreGroupFeatures = () => {};
    let groupViewAdjusted = false;
    let selectionCleared = false;
    exportInProgress = true;

    const renderImage = async (): Promise<Blob> => {
        uiStore.setImageExportState(true, new Set());
        mapElement.setAttribute('aria-busy', 'true');
        mapElement.style.pointerEvents = 'none';
        mapElement.inert = true;

        await settleMapViewForExport(map);
        originalCenter = map.getCenter();
        originalZoom = map.getZoom();

        if (selectedFeatures.length > 0) {
            applySelectionHighlights([], true, selectedFeatures);
            selectionCleared = true;
        }

        mapElement.style.width = `${width}px`;
        mapElement.style.height = `${height}px`;
        mapElement.style.setProperty('--image-export-width', `${width}px`);
        map.invalidateSize({ pan: true, debounceMoveend: false });
        await waitForExportFrame();
        await waitForExportFrame();

        if (isGroupSelection && selectedFeatures.length > 0) {
            groupViewAdjusted = true;
            map.fitBounds(L.latLngBounds(selectedFeatures.map(({ latLng }) => latLng)), {
                padding: [50, 50],
                animate: false
            });
        }

        const visibleLayers = getVisibleLegendLayers({
            map,
            layers: mapStore.layers,
            activeLayerIds: settingsStore.activeLayers,
            visibleLayerIds: mapStore.visibleLayerIds,
            legendLayerIds: uiStore.legendLayerIds
        });
        uiStore.setImageExportState(true, new Set(visibleLayers.map((layer) => layer.id)));
        await nextTick();
        await waitForExportFrame();

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

        if (isGroupSelection) {
            restoreGroupFeatures = revealSelectedGroupFeatures(
                mapElement,
                selectedFeatures.map(({ marker }) => marker)
            );
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

        return createPngBlob(canvas);
    };

    const image = renderImage();
    let delivery: Promise<void>;
    try {
        delivery = deliverImage(image);
    } catch (error) {
        delivery = Promise.reject(error);
    }

    return (async () => {
        try {
            const [rendered, delivered] = await Promise.allSettled([image, delivery]);
            if (rendered.status === 'rejected') {
                throw rendered.reason;
            }
            if (delivered.status === 'rejected') {
                throw delivered.reason;
            }
        } finally {
            try {
                restoreGroupFeatures();
                mapElement.style.pointerEvents = originalPointerEvents;
                mapElement.inert = originalInert;
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
                map.invalidateSize({ pan: true, debounceMoveend: false });
                if (groupViewAdjusted) {
                    map.setView(originalCenter, originalZoom, { animate: false });
                }
                if (selectionCleared) {
                    applySelectionHighlights(selectedFeatures, true, []);
                }
            } finally {
                uiStore.setImageExportState(false, null);
                exportInProgress = false;
            }
        }
    })();
}

export async function exportMapAsPng(width: number, height: number): Promise<void> {
    await performImageExport(width, height, async (image) => {
        const blob = await image;
        downloadBlob(blob, buildImageExportFilename(useSettingsStore(pinia).title));
    });
}

export async function copyMapAsPng(width: number, height: number): Promise<void> {
    const uiStore = useUiStore(pinia);
    uiStore.setImageCopied(false);
    const writeImage = getPngClipboardWriter();
    await performImageExport(width, height, writeImage);
    uiStore.setImageCopied(true);
}
