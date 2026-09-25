import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('leaflet', () => import('../__mocks__/leaflet'));
vi.mock('../../../src/composables/layers/ltnSvgHitTesting', () => ({
    isHoveringPolygonFill: vi.fn(),
    isHoveringPolygonStroke: vi.fn()
}));

import * as L from 'leaflet';
import { createLtnCursorController } from '../../../src/composables/layers/ltnCursorController';
import {
    isHoveringPolygonFill,
    isHoveringPolygonStroke
} from '../../../src/composables/layers/ltnSvgHitTesting';

interface CursorState {
    selectionMode: 'draw' | 'edit';
    layerActive: boolean;
    readOnly: boolean;
    groupedFeature: Element | null;
}

let map: L.Map;
let state: CursorState;
let mouseMarker: HTMLDivElement;
let hoverStack: Element[];
let elementsFromPoint: ReturnType<typeof vi.fn>;
let queuedFrameCallback: FrameRequestCallback | null;
let requestFrame: ReturnType<typeof vi.fn>;
let cancelFrame: ReturnType<typeof vi.fn>;

function createController() {
    return createLtnCursorController(map, {
        getSelectionMode: () => state.selectionMode,
        isLayerActive: () => state.layerActive,
        isReadOnly: () => state.readOnly,
        isPointFeatureElement: (element) => element.classList.contains('point-feature'),
        isGroupedFeatureElement: (element) => element === state.groupedFeature
    });
}

function element(...classes: string[]): HTMLDivElement {
    const result = document.createElement('div');
    result.classList.add(...classes);
    return result;
}

function moveMouse(): void {
    map.fire('mousemove', { originalEvent: { clientX: 10, clientY: 20 } });
    expect(queuedFrameCallback).not.toBeNull();
    queuedFrameCallback?.(0);
    queuedFrameCallback = null;
}

beforeEach(() => {
    map = new L.Map();
    state = {
        selectionMode: 'draw',
        layerActive: true,
        readOnly: false,
        groupedFeature: null
    };
    hoverStack = [];
    mouseMarker = element('leaflet-mouse-marker');
    document.body.replaceChildren(element('map'), mouseMarker);
    elementsFromPoint = vi.fn(() => hoverStack);
    Object.defineProperty(document, 'elementsFromPoint', {
        configurable: true,
        value: elementsFromPoint
    });
    queuedFrameCallback = null;
    requestFrame = vi.fn((callback: FrameRequestCallback) => {
        queuedFrameCallback = callback;
        return 17;
    });
    cancelFrame = vi.fn();
    vi.stubGlobal('requestAnimationFrame', requestFrame);
    vi.stubGlobal('cancelAnimationFrame', cancelFrame);
    vi.mocked(isHoveringPolygonStroke).mockReset().mockReturnValue(false);
    vi.mocked(isHoveringPolygonFill).mockReset().mockReturnValue(false);
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete (document as Partial<Document>).elementsFromPoint;
    document.body.replaceChildren();
});

describe('createLtnCursorController', () => {
    it('uses the default cursor for ungrouped features in read-only mode', () => {
        const controller = createController();
        const feature = element('leaflet-interactive');
        state.readOnly = true;
        hoverStack = [feature, mouseMarker];
        controller.start();

        moveMouse();

        expect(mouseMarker.style.cursor).toBe('default');
        expect(isHoveringPolygonStroke).not.toHaveBeenCalled();
    });

    it('keeps grouped LTN features interactive in read-only mode', () => {
        const controller = createController();
        const feature = element('leaflet-interactive', 'ltn-cell');
        state.readOnly = true;
        state.groupedFeature = feature;
        hoverStack = [feature, mouseMarker];
        controller.start();

        moveMouse();

        expect(mouseMarker.style.cursor).toBe('pointer');
    });

    it('uses a pointer over point features while editing', () => {
        const controller = createController();
        const pointFeature = element('point-feature');
        state.selectionMode = 'edit';
        hoverStack = [pointFeature, mouseMarker];
        controller.start();

        moveMouse();

        expect(mouseMarker.style.cursor).toBe('pointer');
    });

    it.each([
        { hit: 'stroke', stroke: true, fill: false, cursor: 'crosshair' },
        { hit: 'fill', stroke: false, fill: true, cursor: 'pointer' },
        { hit: 'outside', stroke: false, fill: false, cursor: 'grab' }
    ])('uses $cursor for an LTN polygon $hit while editing', ({ stroke, fill, cursor }) => {
        const controller = createController();
        const polygon = element('leaflet-interactive', 'ltn-cell');
        state.selectionMode = 'edit';
        hoverStack = [polygon, mouseMarker];
        vi.mocked(isHoveringPolygonStroke).mockReturnValue(stroke);
        vi.mocked(isHoveringPolygonFill).mockReturnValue(fill);
        controller.start();

        moveMouse();

        expect(mouseMarker.style.cursor).toBe(cursor);
        expect(polygon.style.cursor).toBe(cursor === 'grab' ? '' : cursor);
    });

    it('uses pointer over other interactive shapes and grab over empty map while editing', () => {
        const controller = createController();
        state.selectionMode = 'edit';
        controller.start();

        hoverStack = [element('leaflet-interactive'), mouseMarker];
        moveMouse();
        expect(mouseMarker.style.cursor).toBe('pointer');

        hoverStack = [mouseMarker];
        moveMouse();
        expect(mouseMarker.style.cursor).toBe('grab');
    });

    it('uses pointer over LTN cells while drawing and clears the cursor away from features', () => {
        const controller = createController();
        const polygon = element('leaflet-interactive', 'ltn-cell');
        controller.start();

        hoverStack = [polygon, mouseMarker];
        moveMouse();
        expect(mouseMarker.style.cursor).toBe('pointer');

        mouseMarker.style.cursor = 'crosshair';
        hoverStack = [mouseMarker];
        moveMouse();
        expect(mouseMarker.style.cursor).toBe('');
    });

    it.each([
        { stroke: true, fill: false, cursor: 'crosshair' },
        { stroke: false, fill: true, cursor: 'pointer' },
        { stroke: false, fill: false, cursor: 'grab' }
    ])('sets the polygon edit cursor to $cursor', ({ stroke, fill, cursor }) => {
        const controller = createController();
        const polygon = element('ltn-cell');
        state.selectionMode = 'edit';
        vi.mocked(isHoveringPolygonStroke).mockReturnValue(stroke);
        vi.mocked(isHoveringPolygonFill).mockReturnValue(fill);

        controller.syncPolygonEditCursor(polygon, 10, 20);

        expect(polygon.style.cursor).toBe(cursor === 'grab' ? '' : cursor);
        expect(mouseMarker.style.cursor).toBe(cursor);
    });

    it('cancels and clears a pending mousemove animation frame when stopped', () => {
        const controller = createController();
        const feature = element('leaflet-interactive', 'ltn-cell');
        hoverStack = [feature, mouseMarker];
        controller.start();
        map.fire('mousemove', { originalEvent: { clientX: 10, clientY: 20 } });

        expect(requestFrame).toHaveBeenCalledOnce();
        expect(queuedFrameCallback).not.toBeNull();

        controller.stop();
        queuedFrameCallback?.(0);

        expect(cancelFrame).toHaveBeenCalledWith(17);
        expect(elementsFromPoint).not.toHaveBeenCalled();
        expect(mouseMarker.style.cursor).toBe('');
        expect(feature.style.cursor).toBe('');

        map.fire('mousemove', { originalEvent: { clientX: 10, clientY: 20 } });
        expect(requestFrame).toHaveBeenCalledOnce();
    });
});
