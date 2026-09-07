/**
 * useToolbarDockScale.ts
 *
 * macOS-dock-style hover scaling for the vertical toolbar button list.
 * Tracks each registered button's rect and grows the nearest-to-cursor
 * buttons on mousemove, respecting prefers-reduced-motion.
 */
import { reactive, onUnmounted, type Ref } from 'vue';

const SIGMA = 52;
const MAX_GROW = 0.45;

function dockScale(dist: number): number {
    return 1 + MAX_GROW * Math.exp(-(dist ** 2) / (2 * SIGMA ** 2));
}

export function useToolbarDockScale(toolbarRef: Ref<HTMLUListElement | null>) {
    const buttonMap = new Map<string, HTMLButtonElement>();
    const buttonRects = new Map<string, DOMRect>();
    const buttonScales = reactive<Record<string, number>>({});
    const reducedMotion =
        typeof window !== 'undefined'
            ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
            : false;

    function registerDockButton(id: string, el: HTMLButtonElement | null) {
        if (el) {
            buttonMap.set(id, el);
            buttonRects.set(id, el.getBoundingClientRect());
            if (!(id in buttonScales)) {
                buttonScales[id] = 1;
            }
        } else {
            buttonMap.delete(id);
            buttonRects.delete(id);
            delete buttonScales[id];
        }
    }

    function cacheRects() {
        buttonMap.forEach((el, id) => {
            buttonRects.set(id, el.getBoundingClientRect());
        });
    }

    function onDockMouseMove(e: MouseEvent) {
        if (reducedMotion) {
            return;
        }
        const y = e.clientY;
        buttonMap.forEach((_, id) => {
            const rect = buttonRects.get(id);
            if (!rect) {
                return;
            }
            const center = rect.top + rect.height / 2;
            buttonScales[id] = dockScale(Math.abs(y - center));
        });
    }

    function onDockMouseLeave() {
        Object.keys(buttonScales).forEach((id) => {
            buttonScales[id] = 1;
        });
    }

    let resizeObserver: ResizeObserver | null = null;

    function startObserving() {
        cacheRects();
        if (toolbarRef.value) {
            resizeObserver = new ResizeObserver(cacheRects);
            resizeObserver.observe(toolbarRef.value);
        }
    }

    onUnmounted(() => {
        resizeObserver?.disconnect();
    });

    return {
        buttonScales,
        registerDockButton,
        onDockMouseMove,
        onDockMouseLeave,
        startObserving
    };
}
