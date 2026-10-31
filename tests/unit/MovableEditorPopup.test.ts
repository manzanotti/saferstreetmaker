import * as L from 'leaflet';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeEditorPopupMovable } from '../../src/composables/layers/features/movableEditorPopup';
import {
    buildDeletePopup,
    buildFeatureActionPopup,
    setFeatureActionPopupContent
} from '../../src/composables/layers/features/featureActionPopup';
import { buildFeatureDescriptionPopup } from '../../src/composables/layers/features/featureDescriptionPopup';
import { createLtnPopup } from '../../src/composables/layers/ltn/ltnPopup';

describe('movable editor pop-ups', () => {
    let popup: L.Popup;
    let element: HTMLDivElement;
    let popupMap: L.Map;
    let anchorX: number;
    let anchorY: number;

    beforeEach(() => {
        popupMap = L.map(document.createElement('div'));
        anchorX = 100;
        anchorY = 100;
        element = document.createElement('div');
        element.innerHTML = '<strong>Groups</strong><input><button>Copy</button><select></select>';
        element.style.transform = 'translate3d(100px, 200px, 0px)';
        document.body.append(element);
        vi.spyOn(element, 'getBoundingClientRect').mockImplementation(() => {
            const [x, y] = element.style.translate.split(' ').map(Number.parseFloat);
            return new DOMRect(anchorX + (x || 0), anchorY + (y || 0), 300, 200);
        });
    });

    afterEach(() => {
        popup?.fire('remove');
        popupMap.remove();
        element.remove();
    });

    function mount(nextPopup: L.Popup) {
        popup = nextPopup;
        vi.spyOn(popup, 'getElement').mockReturnValue(element);
        popup.fire('add');
        return popup;
    }

    function pointer(type: string, target: EventTarget, x: number, y: number) {
        const event = new MouseEvent(type, {
            clientX: x,
            clientY: y,
            bubbles: true,
            cancelable: true
        });
        Object.defineProperties(event, {
            pointerType: { value: 'mouse' },
            pointerId: { value: 1 },
            isPrimary: { value: true }
        });
        target.dispatchEvent(event);
    }

    function drag() {
        pointer('pointerdown', element.querySelector('strong')!, 120, 120);
        pointer('pointermove', document, 170, 140);
        pointer('pointerup', document, 170, 140);
    }

    it('uses a separate translate layer and preserves Leaflet positioning updates', () => {
        const nextPopup = L.popup();
        expect(makeEditorPopupMovable(nextPopup, popupMap)).toBe(nextPopup);
        mount(nextPopup);
        drag();
        expect(element.style.translate).toBe('50px 20px');
        expect(element.style.transform).toBe('translate3d(100px, 200px, 0px)');
        element.style.transform = 'translate3d(200px, 300px, 0px)';
        drag();
        expect(element.style.translate).toBe('100px 40px');
        expect(element.style.transform).toBe('translate3d(200px, 300px, 0px)');
    });

    it.each(['input', 'button', 'select'])('does not hijack editor %s controls', (selector) => {
        mount(makeEditorPopupMovable(L.popup(), popupMap));
        pointer('pointerdown', element.querySelector(selector)!, 120, 120);
        pointer('pointermove', document, 170, 140);
        pointer('pointerup', document, 170, 140);
        expect(element.style.translate).toBe('');
        expect(element.classList.contains('panel-moving')).toBe(false);
    });

    it('cleans up during a drag and starts at its default offset when reopened', () => {
        mount(makeEditorPopupMovable(L.popup(), popupMap));
        pointer('pointerdown', element, 120, 120);
        pointer('pointermove', document, 170, 140);
        popup.fire('remove');
        expect(element.style.translate).toBe('');
        expect(element.style.transform).toBe('translate3d(100px, 200px, 0px)');
        expect(element.classList.contains('movable-panel')).toBe(false);
        expect(document.documentElement.classList.contains('panel-dragging')).toBe(false);
        pointer('pointermove', document, 200, 180);
        expect(element.style.translate).toBe('');
        popup.fire('add');
        drag();
        expect(element.style.translate).toBe('50px 20px');
    });

    it('enables action editors and preserves movement when their content is refreshed', () => {
        const map = L.map(document.createElement('div'));
        const options = {
            map,
            popupOptions: {},
            member: { layerId: 'MobilityLanes', historyId: 'line-1' },
            name: 'Original',
            onRename: vi.fn(),
            onDelete: vi.fn()
        };
        try {
            mount(buildFeatureActionPopup(options));
            drag();
            setFeatureActionPopupContent(popup, { ...options, name: 'Updated' });
            expect(element.classList.contains('movable-editor-popup')).toBe(true);
            expect(element.style.translate).toBe('50px 20px');
            const content = popup.getContent() as HTMLElement;
            const input = content.querySelector('input')!;
            expect(input.value).toBe('Updated');
            input.value = 'Renamed';
            input.dispatchEvent(new Event('blur'));
            expect(options.onRename).toHaveBeenCalledWith('Renamed');
        } finally {
            map.remove();
        }
    });

    it.each(['moveend', 'zoomend', 'resize'])(
        're-constrains a moved editor after map %s',
        (event) => {
            mount(makeEditorPopupMovable(L.popup(), popupMap));
            drag();
            anchorX = window.innerWidth - 100;
            anchorY = window.innerHeight - 100;
            popupMap.fire(event);
            const rect = element.getBoundingClientRect();
            expect(rect.right).toBeLessThanOrEqual(window.innerWidth);
            expect(rect.bottom).toBeLessThanOrEqual(window.innerHeight);
            expect(element.style.transform).toBe('translate3d(100px, 200px, 0px)');
        }
    );

    it('waits for map resizing and does not add an offset to an untouched editor', () => {
        mount(makeEditorPopupMovable(L.popup(), popupMap));
        anchorX = window.innerWidth;
        window.dispatchEvent(new Event('resize'));
        expect(element.style.translate).toBe('');
        anchorX = 100;
        popupMap.fire('resize');
        expect(element.style.translate).toBe('');
    });

    it('removes map constraints on close and reinstates them once on reopening', () => {
        mount(makeEditorPopupMovable(L.popup(), popupMap));
        drag();
        popup.fire('remove');
        const measure = vi.mocked(element.getBoundingClientRect);
        measure.mockClear();
        for (const event of ['moveend', 'zoomend', 'resize']) {
            popupMap.fire(event);
        }
        expect(measure).not.toHaveBeenCalled();
        popup.fire('add');
        drag();
        measure.mockClear();
        popupMap.fire('moveend');
        expect(measure).toHaveBeenCalledTimes(1);
    });

    it('enables copy/delete-only action pop-ups', () => {
        const map = L.map(document.createElement('div'));
        try {
            mount(buildDeletePopup(map, {}, vi.fn(), vi.fn()));
            drag();
            expect(element.classList.contains('movable-editor-popup')).toBe(true);
            expect(element.style.translate).toBe('50px 20px');
        } finally {
            map.remove();
        }
    });

    it('enables the LTN label/colour editor', () => {
        const map = L.map(document.createElement('div'));
        const editor = createLtnPopup(
            map,
            { options: { color: '#cc00cc' }, properties: { historyId: 'cell-1' } },
            'Cell',
            {
                defaultColor: '#cc00cc',
                getHistoryFeature: vi.fn(),
                onPolygonMutation: vi.fn(),
                syncTooltip: vi.fn(),
                recomputeFeatureVisibility: vi.fn(),
                onCopy: vi.fn(),
                onDelete: vi.fn(),
                onOpenGroup: vi.fn(),
                onRemoveFromGroup: vi.fn(),
                onAddToGroup: vi.fn(),
                onCreateNewGroup: vi.fn()
            }
        );
        try {
            mount(editor.popup);
            drag();
            expect(element.style.translate).toBe('50px 20px');
            expect(editor.labelEl.value).toBe('Cell');
            expect(editor.colorEl.value).toBe('#cc00cc');
        } finally {
            editor.dispose();
            map.remove();
        }
    });

    it('leaves hover descriptions non-movable', () => {
        const description = buildFeatureDescriptionPopup(
            {},
            { layerId: 'MobilityLanes', historyId: 'line-description' },
            'hover',
            { featureName: 'Named line' }
        );
        expect(description).not.toBeNull();
        mount(description!);
        drag();
        expect(element.classList.contains('movable-editor-popup')).toBe(false);
        expect(element.style.translate).toBe('');
    });
});
