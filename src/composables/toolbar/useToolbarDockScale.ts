import { onMounted, onUnmounted, reactive, ref } from 'vue';

const SIGMA = 52;
const MAX_GROW = 0.45;

function dockScale(distance: number): number {
    return 1 + MAX_GROW * Math.exp(-(distance ** 2) / (2 * SIGMA ** 2));
}

export function useToolbarDockScale() {
    const toolbarRef = ref<HTMLUListElement | null>(null);
    const buttonScales = reactive<Record<string, number>>({});
    const buttonMap = new Map<string, HTMLButtonElement>();
    const buttonRects = new Map<string, DOMRect>();
    const reducedMotion =
        typeof window !== 'undefined'
            ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
            : false;
    let resizeObserver: ResizeObserver | null = null;

    function registerDockButton(id: string, el: HTMLButtonElement | null) {
        if (el) {
            buttonMap.set(id, el);
            buttonRects.set(id, el.getBoundingClientRect());
            if (!(id in buttonScales)) {
                buttonScales[id] = 1;
            }
            return;
        }

        buttonMap.delete(id);
        buttonRects.delete(id);
        delete buttonScales[id];
    }

    function cacheRects() {
        buttonMap.forEach((el, id) => {
            buttonRects.set(id, el.getBoundingClientRect());
        });
    }

    function onDockMouseMove(event: MouseEvent) {
        if (reducedMotion) {
            return;
        }
        const y = event.clientY;
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

    onMounted(() => {
        cacheRects();
        if (toolbarRef.value) {
            resizeObserver = new ResizeObserver(cacheRects);
            resizeObserver.observe(toolbarRef.value);
        }
    });

    onUnmounted(() => resizeObserver?.disconnect());

    return {
        toolbarRef,
        buttonScales,
        registerDockButton,
        onDockMouseMove,
        onDockMouseLeave
    };
}
