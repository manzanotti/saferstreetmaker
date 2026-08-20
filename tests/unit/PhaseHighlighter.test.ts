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

    it('dims only features outside the selected group', () => {
        const groupElement = document.createElement('div');
        groupElement.style.opacity = '0.8';
        const outsideElement = document.createElement('div');
        outsideElement.style.opacity = '0.9';
        const groupMarker = { getElement: () => groupElement } as unknown as L.Layer;
        const outsideMarker = { getElement: () => outsideElement } as unknown as L.Layer;
        const markers = new Map([
            ['group-1', groupMarker],
            ['outside-1', outsideMarker]
        ]);
        const highlighter = new PhaseHighlighter((member) => markers.get(member.historyId) ?? null);

        highlighter.dimOutside(
            [
                { layerId: 'ModalFilters', historyId: 'group-1' },
                { layerId: 'ModalFilters', historyId: 'outside-1' }
            ],
            new Set(['ModalFilters:group-1'])
        );

        expect(groupElement.style.opacity).toBe('0.8');
        expect(outsideElement.style.opacity).toBe('0.12');
    });

    it("scales playback opacity up to each feature's normal opacity", () => {
        const syncGroupStyle = vi.fn();
        const marker = {
            options: {
                opacity: 0.7,
                fillOpacity: 0.2
            },
            setStyle: vi.fn(function (this: any, style: object) {
                Object.assign(this.options, style);
            }),
            syncGroupStyle
        } as unknown as L.Layer & { options: Record<string, unknown> };
        const member = { layerId: 'LtnCells', historyId: 'cell-1' };
        const highlighter = new PhaseHighlighter(() => marker);
        const groupKey = 'LtnCells:cell-1';

        highlighter.setProgress(
            [member],
            new Set([groupKey]),
            0.5,
            new Set(),
            new Set(),
            new Set([groupKey])
        );
        expect(marker.options.opacity).toBeCloseTo(0.35);
        expect(marker.options.fillOpacity).toBeCloseTo(0.1);

        highlighter.setProgress(
            [member],
            new Set([groupKey]),
            1,
            new Set([groupKey]),
            new Set(),
            new Set([groupKey])
        );
        expect(marker.options.opacity).toBeCloseTo(0.7);
        expect(marker.options.fillOpacity).toBeCloseTo(0.2);
    });
});
