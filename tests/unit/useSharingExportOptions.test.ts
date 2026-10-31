/**
 * Unit tests for useSharingExportOptions — sharing panel dimensions and export format state.
 */
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import type * as L from 'leaflet';
import { useSharingExportOptions } from '../../src/composables/panels/useSharingExportOptions';
import { useMapStore } from '../../src/stores/mapStore';

describe('useSharingExportOptions', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
    });

    it('defaults to HTML with no dimensions when there is no map', () => {
        const { width, height, exportFormat, exportValidationError, hasEmbedDimensions } =
            useSharingExportOptions();

        expect(width.value).toBeNull();
        expect(height.value).toBeNull();
        expect(exportFormat.value).toBe('html');
        expect(exportValidationError.value).toBeNull();
        expect(hasEmbedDimensions()).toBe(false);
    });

    it('initialises dimensions from the rounded map size', () => {
        useMapStore().setMap({ getSize: () => ({ x: 800.4, y: 599.6 }) } as unknown as L.Map);

        const { width, height, hasEmbedDimensions } = useSharingExportOptions();

        expect(width.value).toBe(800);
        expect(height.value).toBe(600);
        expect(hasEmbedDimensions()).toBe(true);
    });

    it('only validates dimensions for image exports', () => {
        const { width, height, exportFormat, exportValidationError } = useSharingExportOptions();
        width.value = 10;
        height.value = 10;

        expect(exportValidationError.value).toBeNull();

        exportFormat.value = 'image';
        expect(exportValidationError.value).not.toBeNull();

        width.value = 1024;
        height.value = 768;
        expect(exportValidationError.value).toBeNull();
    });

    it('rejects non-positive embed dimensions', () => {
        const { width, height, hasEmbedDimensions } = useSharingExportOptions();
        width.value = 0;
        height.value = 200;
        expect(hasEmbedDimensions()).toBe(false);

        width.value = 200;
        expect(hasEmbedDimensions()).toBe(true);
    });
});
