import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('leaflet', () => import('./__mocks__/leaflet'));

import { makeLeafletVueControl } from '../../src/composables/useLeafletVueControl';

describe('makeLeafletVueControl', () => {
    let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
    let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.useFakeTimers();
        addEventListenerSpy = vi.spyOn(document, 'addEventListener');
        removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
    });

    afterEach(() => {
        vi.useRealTimers();
        addEventListenerSpy.mockRestore();
        removeEventListenerSpy.mockRestore();
        vi.clearAllMocks();
    });

    it('removes the document dblclick guard on control removal', () => {
        const control = makeLeafletVueControl({ template: '<div>Test</div>' } as any);
        const container = control.onAdd?.({} as any);

        expect(container).toBeTruthy();
        const addCall = addEventListenerSpy.mock.calls.find((call) => {
            return call[0] === 'dblclick' && call[2] === true;
        });
        expect(addCall).toBeTruthy();

        control.onRemove?.({} as any);

        const removeCall = removeEventListenerSpy.mock.calls.find((call) => {
            return call[0] === 'dblclick' && call[2] === true;
        });
        expect(removeCall).toBeTruthy();
        expect(removeCall?.[1]).toBe(addCall?.[1]);
    });

    it('disarms the one-shot dblclick guard after a short timeout', () => {
        const control = makeLeafletVueControl({ template: '<div>Test</div>' } as any);
        const container = control.onAdd?.({} as any) as HTMLDivElement;

        const addCall = addEventListenerSpy.mock.calls.find((call) => {
            return call[0] === 'dblclick' && call[2] === true;
        });
        expect(addCall).toBeTruthy();

        const documentDblClickHandler = addCall?.[1] as EventListener;

        const preventDefault = vi.fn();
        const stopPropagation = vi.fn();
        const stopImmediatePropagation = vi.fn();

        container.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        vi.advanceTimersByTime(400);

        documentDblClickHandler({
            target: document.body,
            preventDefault,
            stopPropagation,
            stopImmediatePropagation
        } as unknown as MouseEvent);

        expect(preventDefault).not.toHaveBeenCalled();
        expect(stopPropagation).not.toHaveBeenCalled();
        expect(stopImmediatePropagation).not.toHaveBeenCalled();
    });
});
