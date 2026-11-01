import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as L from 'leaflet';
import { pinia } from '../../src/stores';
import { useMapStore } from '../../src/stores/mapStore';
import { useSelectionStore } from '../../src/stores/selectionStore';
import { useUiStore } from '../../src/stores/uiStore';

const mocks = vi.hoisted(() => ({
    writer: vi.fn(),
    writerFactory: vi.fn(),
    settle: vi.fn(),
    frame: vi.fn(),
    assets: vi.fn(),
    canvas: vi.fn(),
    blob: vi.fn()
}));

vi.mock('leaflet', () => import('./__mocks__/leaflet'));
vi.mock('../../src/features/export/imageClipboard', () => ({
    getPngClipboardWriter: mocks.writerFactory
}));
vi.mock('../../src/features/export/imageExportAssets', () => ({
    settleMapViewForExport: mocks.settle,
    waitForExportFrame: mocks.frame,
    waitForMapAssets: mocks.assets,
    createPngBlob: mocks.blob,
    removeMapControlsFromClone: vi.fn()
}));
vi.mock('../../src/features/export/visibleLegendLayers', () => ({
    getVisibleLegendLayers: () => []
}));
vi.mock('html2canvas-pro', () => ({ default: mocks.canvas }));

import { copyMapAsPng, exportMapAsPng } from '../../src/features/export/mapImageExport';

function deferred<T>() {
    let resolve: (value: T) => void = () => {
        throw new Error('Promise was not initialized');
    };
    const promise = new Promise<T>((finish) => {
        resolve = finish;
    });
    return { promise, resolve };
}

describe('map image clipboard transaction', () => {
    let map: L.Map;
    let element: HTMLElement;

    beforeEach(() => {
        vi.resetAllMocks();
        map = new L.Map(document.createElement('div'));
        Object.assign(map, { invalidateSize: vi.fn(() => map) });
        element = map.getContainer();
        element.setAttribute('style', 'width: 900px; height: 700px;');
        element.inert = false;
        useMapStore(pinia).setMap(map);
        useMapStore(pinia).setDrawLayer(null);
        useSelectionStore(pinia).deactivate();
        useUiStore(pinia).setImageExportState(false, null);
        useUiStore(pinia).setImageCopied(false);
        mocks.writerFactory.mockReturnValue(mocks.writer);
        mocks.writer.mockResolvedValue(undefined);
        mocks.settle.mockResolvedValue(undefined);
        mocks.frame.mockResolvedValue(undefined);
        mocks.assets.mockResolvedValue(undefined);
        mocks.canvas.mockResolvedValue({ width: 320, height: 280 });
        mocks.blob.mockResolvedValue(new Blob(['png'], { type: 'image/png' }));
    });

    it('waits for rendering and restores the map after an early clipboard failure', async () => {
        const assets = deferred<void>();
        mocks.assets.mockReturnValue(assets.promise);
        mocks.writer.mockRejectedValue(new Error('Clipboard denied'));
        const copying = copyMapAsPng(320, 280);
        const failure = expect(copying).rejects.toThrow('Clipboard denied');

        expect(mocks.writer).toHaveBeenCalledOnce();
        await vi.waitFor(() => expect(mocks.assets).toHaveBeenCalledOnce());
        expect(element.style.width).toBe('320px');
        expect(useUiStore(pinia).imageExportInProgress).toBe(true);
        assets.resolve();
        await failure;

        expect(element.getAttribute('style')).toBe('width: 900px; height: 700px;');
        expect(element.hasAttribute('aria-busy')).toBe(false);
        expect(element.inert).toBe(false);
        expect(useUiStore(pinia).imageExportInProgress).toBe(false);
        expect(useUiStore(pinia).imageCopied).toBe(false);
    });

    it('holds the export lock until the clipboard write completes', async () => {
        const delivery = deferred<void>();
        mocks.writer.mockReturnValue(delivery.promise);
        const copying = copyMapAsPng(320, 280);

        await vi.waitFor(() => expect(mocks.blob).toHaveBeenCalledOnce());
        expect(useUiStore(pinia).imageExportInProgress).toBe(true);
        await expect(exportMapAsPng(320, 280)).rejects.toThrow('already in progress');
        delivery.resolve();
        await copying;
        expect(useUiStore(pinia).imageExportInProgress).toBe(false);
        expect(useUiStore(pinia).imageCopied).toBe(true);
        expect(element.getAttribute('style')).toBe('width: 900px; height: 700px;');
    });

    it('reports rendering failures and restores the map without a success notice', async () => {
        mocks.assets.mockRejectedValue(new Error('Map tiles failed'));
        await expect(copyMapAsPng(320, 280)).rejects.toThrow('Map tiles failed');
        expect(useUiStore(pinia).imageExportInProgress).toBe(false);
        expect(useUiStore(pinia).imageCopied).toBe(false);
        expect(element.getAttribute('style')).toBe('width: 900px; height: 700px;');
    });

    it('rejects invalid dimensions before starting a clipboard write', async () => {
        await expect(copyMapAsPng(255, 280)).rejects.toThrow('between 256 and 8192');
        expect(mocks.writer).not.toHaveBeenCalled();
        expect(useUiStore(pinia).imageExportInProgress).toBe(false);
    });
});
