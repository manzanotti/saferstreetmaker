import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as L from 'leaflet';
import { defineComponent, h, onUnmounted } from 'vue';

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
        control.onRemove?.({} as any);
    });

    it('unmounts each Vue app exactly once and mounts a fresh app when re-added', () => {
        const unmounted = vi.fn();
        const component = defineComponent({
            setup() {
                onUnmounted(unmounted);
                return () => h('span', 'Mounted control');
            }
        });
        const map = new L.Map(document.createElement('div'));
        const control = makeLeafletVueControl(component);
        const first = control.onAdd(map);

        expect(first.textContent).toBe('Mounted control');
        control.onRemove?.(map);
        control.onRemove?.(map);
        expect(first.textContent).toBe('');
        expect(unmounted).toHaveBeenCalledOnce();

        const second = control.onAdd(map);
        expect(second).not.toBe(first);
        expect(second.textContent).toBe('Mounted control');
        control.onRemove?.(map);
        expect(second.textContent).toBe('');
        expect(unmounted).toHaveBeenCalledTimes(2);
    });
});
