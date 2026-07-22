import { describe, expect, it } from 'vitest';
import type * as L from 'leaflet';
import type { Group } from '../../src/models/Group';
import {
    GroupLtnFillController,
    resolveLtnFill
} from '../../src/features/groups/GroupLtnFillController';

function group(id: string, color: string, historyId: string): Group {
    return {
        id,
        name: id,
        color,
        members: [{ layerId: 'LtnCells', historyId }]
    };
}

function makeMarker(historyId: string, svg: SVGSVGElement) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    svg.appendChild(path);
    const marker = {
        properties: { historyId },
        options: { color: '#cc00cc' },
        getElement: () => path,
        setStyle(style: L.PathOptions) {
            Object.assign(marker.options, style);
        }
    };
    return marker;
}

describe('GroupLtnFillController', () => {
    it('resolves no group colours to the cell colour', () => {
        expect(resolveLtnFill([], '#cc00cc')).toEqual({
            kind: 'fallback',
            fillColor: '#cc00cc',
            colors: []
        });
    });

    it('collapses duplicate group colours to one solid fill', () => {
        expect(resolveLtnFill(['#00aa00', '#00AA00'], '#cc00cc')).toEqual({
            kind: 'solid',
            fillColor: '#00aa00',
            colors: ['#00aa00']
        });
    });

    it('ignores invalid group colours before creating presentation styles', () => {
        expect(
            resolveLtnFill(['url(#unsafe)', '#00AA00', 42 as unknown as string], '#cc00cc')
        ).toEqual({
            kind: 'solid',
            fillColor: '#00aa00',
            colors: ['#00aa00']
        });
    });

    it('resolves multiple colours to ordered stripes', () => {
        expect(resolveLtnFill(['#00aa00', '#aa0000'], '#cc00cc')).toEqual({
            kind: 'pattern',
            fillColor: '',
            colors: ['#00aa00', '#aa0000']
        });
    });

    it('applies solid fill and stroke without changing the cell colour', () => {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const marker = makeMarker('cell-1', svg);
        const groups = [group('visible', '#00aa00', 'cell-1')];
        groups.push({
            id: 'hidden',
            name: 'hidden',
            color: '#aa0000',
            members: [{ layerId: 'LtnCells', historyId: 'cell-1' }]
        });
        const controller = new GroupLtnFillController({
            getGroups: () => groups,
            getHiddenGroupIds: () => new Set(['hidden']),
            getActiveVersionIds: () => ({}),
            getLayer: () =>
                ({ eachLayer: (callback: (layer: unknown) => void) => callback(marker) }) as any
        });

        controller.recompute();

        expect(marker.options.fillColor).toBe('#00aa00');
        expect(marker.options.color).toBe('#cc00cc');
        expect(marker.getElement().getAttribute('stroke')).toBe('#00aa00');
    });

    it('creates a renderer-local pattern containing every unique colour', () => {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const marker = makeMarker('cell-1', svg);
        const groups = [group('first', '#00aa00', 'cell-1'), group('second', '#aa0000', 'cell-1')];
        const controller = new GroupLtnFillController({
            getGroups: () => groups,
            getHiddenGroupIds: () => new Set(),
            getActiveVersionIds: () => ({}),
            getLayer: () =>
                ({ eachLayer: (callback: (layer: unknown) => void) => callback(marker) }) as any
        });

        controller.recompute();

        expect(marker.options.fillColor).toMatch(/^url\(#ssm-ltn-stripes-/);
        expect(marker.options.color).toBe('#cc00cc');
        expect(marker.getElement().getAttribute('stroke')).toMatch(/^url\(#ssm-ltn-stripes-/);
        expect(svg.querySelectorAll('defs[data-ssm-ltn-defs="true"]')).toHaveLength(1);
        expect(svg.querySelectorAll('pattern[data-ssm-ltn-pattern="true"] rect')).toHaveLength(2);
        expect(svg.querySelector('pattern rect[fill="#00aa00"]')).toBeTruthy();
        expect(svg.querySelector('pattern rect[fill="#aa0000"]')).toBeTruthy();
    });
});
