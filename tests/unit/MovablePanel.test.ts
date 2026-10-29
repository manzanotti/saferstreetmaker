import { createApp, h, withDirectives, type App } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { vMovablePanel } from '../../src/directives/movablePanel';

describe('movable panels', () => {
    let app: App;
    let root: HTMLDivElement;
    let panel: HTMLElement;
    let resized: ResizeObserverCallback;
    const disconnect = vi.fn();

    beforeEach(() => {
        vi.useFakeTimers();
        vi.stubGlobal(
            'ResizeObserver',
            class {
                constructor(callback: ResizeObserverCallback) {
                    resized = callback;
                }
                observe() {}
                disconnect = disconnect;
            }
        );
        root = document.createElement('div');
        document.body.append(root);
        app = createApp({
            render: () =>
                withDirectives(
                    h('div', [
                        h('h2', 'Panel'),
                        h('button', [h('span', 'Close')]),
                        h('input'),
                        h('a', { href: '#' }, 'Link'),
                        h('label', 'Label'),
                        h('div', { contenteditable: 'true' }, 'Editor'),
                        h('p', 'Content')
                    ]),
                    [[vMovablePanel]]
                )
        });
        app.mount(root);
        panel = root.firstElementChild as HTMLElement;
        vi.spyOn(panel, 'getBoundingClientRect').mockImplementation(() => {
            const match = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(panel.style.transform);
            return new DOMRect(
                100 + Number(match?.[1] ?? 0),
                100 + Number(match?.[2] ?? 0),
                300,
                200
            );
        });
    });

    afterEach(() => {
        app.unmount();
        root.remove();
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    function pointer(type: string, target: EventTarget, x: number, y: number, button = 0, id = 1) {
        const event = new MouseEvent(type, {
            clientX: x,
            clientY: y,
            button,
            bubbles: true,
            cancelable: true
        });
        Object.defineProperties(event, {
            pointerId: { value: id },
            pointerType: { value: 'mouse' },
            isPrimary: { value: true }
        });
        target.dispatchEvent(event);
        return event;
    }

    function touch(type: string, x: number, y: number, count = 1) {
        const touches = Array.from({ length: count }, (_, identifier) => ({
            identifier,
            clientX: x,
            clientY: y
        }));
        const event = new Event(type, { bubbles: true, cancelable: true });
        Object.defineProperties(event, {
            touches: { value: type === 'touchend' ? [] : touches },
            changedTouches: { value: touches }
        });
        panel.dispatchEvent(event);
        return event;
    }

    it('moves from non-interactive space, shows the move cursor state, and stops on release', () => {
        pointer('pointerdown', panel.querySelector('h2')!, 120, 120);
        expect(panel.classList.contains('panel-moving')).toBe(true);
        pointer('pointermove', document, 180, 160);
        expect(panel.style.transform).toContain('translate(60px, 40px)');
        pointer('pointerup', document, 180, 160);
        expect(document.documentElement.classList.contains('panel-dragging')).toBe(false);
        pointer('pointermove', document, 250, 200);
        expect(panel.style.transform).toContain('translate(60px, 40px)');
    });

    it.each(['button span', 'input', 'a', 'label', '[contenteditable]'])(
        'preserves interactions on %s',
        (selector) => {
            pointer('pointerdown', panel.querySelector(selector)!, 120, 120);
            pointer('pointermove', document, 200, 200);
            expect(panel.style.transform).toBe('');
            expect(panel.classList.contains('panel-moving')).toBe(false);
        }
    );

    it('ignores secondary buttons and other pointers and applies a movement threshold', () => {
        pointer('pointerdown', panel, 120, 120, 2);
        pointer('pointermove', document, 200, 200);
        expect(panel.style.transform).toBe('');
        pointer('pointerdown', panel, 120, 120);
        pointer('pointermove', document, 200, 200, 0, 2);
        pointer('pointermove', document, 122, 121);
        expect(panel.style.transform).toBe('');
    });

    it('keeps panels on screen while dragging, resizing, and changing content size', () => {
        pointer('pointerdown', panel, 120, 120);
        pointer('pointermove', document, -500, -500);
        expect(panel.getBoundingClientRect().left).toBe(0);
        expect(panel.getBoundingClientRect().top).toBe(0);
        pointer('pointermove', document, 3000, 3000);
        expect(panel.getBoundingClientRect().right).toBe(window.innerWidth);
        expect(panel.getBoundingClientRect().bottom).toBe(window.innerHeight);
        pointer('pointerup', document, 3000, 3000);
        vi.stubGlobal('innerWidth', 600);
        window.dispatchEvent(new Event('resize'));
        expect(panel.getBoundingClientRect().right).toBe(600);
        vi.stubGlobal('innerWidth', 500);
        resized([], {} as ResizeObserver);
        expect(panel.getBoundingClientRect().right).toBe(500);
    });

    it('activates touch moving only after a 450ms hold', () => {
        touch('touchstart', 120, 120);
        vi.advanceTimersByTime(449);
        expect(panel.classList.contains('panel-moving')).toBe(false);
        vi.advanceTimersByTime(1);
        expect(panel.classList.contains('panel-moving')).toBe(true);
        expect(touch('touchmove', 180, 160).defaultPrevented).toBe(true);
        expect(panel.style.transform).toContain('translate(60px, 40px)');
        touch('touchend', 180, 160);
        expect(panel.classList.contains('panel-moving')).toBe(false);
    });

    it('preserves scrolling before the hold and cancels short taps and multi-touch', () => {
        touch('touchstart', 120, 120);
        expect(touch('touchmove', 120, 145).defaultPrevented).toBe(false);
        vi.advanceTimersByTime(500);
        expect(panel.classList.contains('panel-moving')).toBe(false);
        touch('touchstart', 120, 120);
        touch('touchend', 120, 120);
        vi.advanceTimersByTime(500);
        expect(panel.classList.contains('panel-moving')).toBe(false);
        touch('touchstart', 120, 120);
        touch('touchstart', 120, 120, 2);
        vi.advanceTimersByTime(500);
        expect(panel.classList.contains('panel-moving')).toBe(false);
    });

    it.each(['pointercancel', 'blur'])('releases drag state on %s', (type) => {
        pointer('pointerdown', panel, 120, 120);
        if (type === 'blur') {
            window.dispatchEvent(new Event('blur'));
        } else {
            pointer(type, document, 150, 150);
        }
        expect(panel.classList.contains('panel-moving')).toBe(false);
        pointer('pointermove', document, 200, 200);
        expect(panel.style.transform).toBe('');
    });

    it('suppresses only the click following a drag, not a regular click', () => {
        const click = vi.fn();
        panel.addEventListener('click', click);
        pointer('pointerdown', panel, 120, 120);
        pointer('pointerup', document, 120, 120);
        panel.click();
        expect(click).toHaveBeenCalledTimes(1);
        pointer('pointerdown', panel, 120, 120);
        pointer('pointermove', document, 150, 150);
        pointer('pointerup', document, 150, 150);
        panel.click();
        expect(click).toHaveBeenCalledTimes(1);
        vi.runOnlyPendingTimers();
        panel.click();
        expect(click).toHaveBeenCalledTimes(2);
    });

    it('cleans up active drags, pending holds, listeners, and observers on unmount', () => {
        touch('touchstart', 120, 120);
        app.unmount();
        vi.runOnlyPendingTimers();
        expect(document.documentElement.classList.contains('panel-dragging')).toBe(false);
        expect(disconnect).toHaveBeenCalled();
        pointer('pointermove', document, 200, 200);
        expect(panel.style.transform).toBe('');
    });
});
