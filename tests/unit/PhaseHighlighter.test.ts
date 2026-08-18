import { describe, expect, it, vi } from 'vitest';
import type * as L from 'leaflet';
import { PhaseHighlighter } from '../../src/features/groups/PhaseHighlighter';

describe('PhaseHighlighter', () => {
    it('restores path opacity after clearing a dimmed feature', () => {
        const syncGroupStyle = vi.fn();
        const element = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const marker = {
            options: {
                opacity: 1,
                fillOpacity: 0.2,
                color: '#cc00cc',
                fillColor: '#00aa00'
            },
            setStyle: vi.fn(function (this: any, style: object) {
                Object.assign(this.options, style);
            }),
            getElement: () => element,
            syncGroupStyle
        } as unknown as L.Layer & { options: Record<string, unknown> };
        const member = { layerId: 'LtnCells', historyId: 'cell-1' };
        const highlighter = new PhaseHighlighter(() => marker);

        highlighter.dim([member], new Set());
        expect(marker.options.opacity).toBe(0.28);
        expect(marker.options.fillOpacity).toBeCloseTo(0.056);
        expect(element.style.opacity).toBe('');
        expect(syncGroupStyle).toHaveBeenCalledOnce();

        highlighter.clear([member]);
        expect(marker.options).toMatchObject({
            opacity: 1,
            fillOpacity: 0.2
        });
        expect(syncGroupStyle).toHaveBeenCalledTimes(2);
    });

    it('dims and restores element opacity for markers without path styling', () => {
        const element = document.createElement('div');
        element.style.opacity = '0.8';
        const marker = {
            getElement: () => element
        } as unknown as L.Layer;
        const member = { layerId: 'BusGates', historyId: 'gate-1' };
        const highlighter = new PhaseHighlighter(() => marker);

        highlighter.dim([member], new Set());
        expect(element.style.opacity).toBe('0.28');

        highlighter.clear([member]);
        expect(element.style.opacity).toBe('0.8');
    });
});
