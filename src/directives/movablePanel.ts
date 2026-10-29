import type { ObjectDirective } from 'vue';

const interactiveSelector =
    'button, a, input, textarea, select, label, summary, [role="button"], [role="tab"], [contenteditable]:not([contenteditable="false"]), [data-no-panel-drag]';
const cleanups = new WeakMap<HTMLElement, () => void>();

function makeMovable(panel: HTMLElement): () => void {
    const listeners = new AbortController();
    const { signal } = listeners;
    const originalTransform = panel.style.transform;
    let x = 0;
    let y = 0;
    let moved = false;
    let active = false;
    let pointerId: number | null = null;
    let touchId: number | null = null;
    let startX = 0;
    let startY = 0;
    let originX = 0;
    let originY = 0;
    let holdTimer: ReturnType<typeof setTimeout> | undefined;
    let clickTimer: ReturnType<typeof setTimeout> | undefined;
    let suppressClick = false;

    panel.classList.add('movable-panel');

    function render() {
        panel.style.transform = `translate(${x}px, ${y}px) ${originalTransform}`;
    }

    function constrain() {
        const rect = panel.getBoundingClientRect();
        if (!rect.width || !rect.height) {
            return;
        }
        x += Math.max(-rect.left, Math.min(0, window.innerWidth - rect.right));
        y += Math.max(-rect.top, Math.min(0, window.innerHeight - rect.bottom));
        render();
    }

    function activate() {
        active = true;
        panel.classList.add('panel-moving');
        document.documentElement.classList.add('panel-dragging');
    }

    function finish() {
        clearTimeout(holdTimer);
        holdTimer = undefined;
        if (moved) {
            suppressClick = true;
            clearTimeout(clickTimer);
            clickTimer = setTimeout(() => {
                suppressClick = false;
            }, 0);
        }
        if (active) {
            document.documentElement.classList.remove('panel-dragging');
        }
        active = false;
        pointerId = null;
        touchId = null;
        panel.classList.remove('panel-moving');
    }

    function canStart(target: EventTarget | null) {
        return (
            target instanceof Element &&
            !target.closest(interactiveSelector) &&
            !target.closest('[inert]') &&
            !document.documentElement.classList.contains('panel-dragging')
        );
    }

    function begin(clientX: number, clientY: number) {
        clearTimeout(clickTimer);
        suppressClick = false;
        moved = false;
        startX = clientX;
        startY = clientY;
        originX = x;
        originY = y;
    }

    function move(clientX: number, clientY: number) {
        if (Math.hypot(clientX - startX, clientY - startY) < 4 && !moved) {
            return;
        }
        moved = true;
        x = originX + clientX - startX;
        y = originY + clientY - startY;
        render();
        constrain();
    }

    panel.addEventListener(
        'pointerdown',
        (event) => {
            // Touch uses non-passive touch events so scrolling remains native until the hold.
            if (
                event.pointerType === 'touch' ||
                event.button !== 0 ||
                !event.isPrimary ||
                !canStart(event.target)
            ) {
                return;
            }
            begin(event.clientX, event.clientY);
            pointerId = event.pointerId;
            activate();
            event.preventDefault();
            event.stopPropagation();
        },
        { signal }
    );
    document.addEventListener(
        'pointermove',
        (event) => {
            if (pointerId !== event.pointerId) {
                return;
            }
            move(event.clientX, event.clientY);
            event.preventDefault();
            event.stopPropagation();
        },
        { signal, capture: true, passive: false }
    );
    for (const type of ['pointerup', 'pointercancel'] as const) {
        document.addEventListener(
            type,
            (event) => {
                if (pointerId === event.pointerId) {
                    event.stopPropagation();
                    finish();
                }
            },
            { signal, capture: true }
        );
    }

    panel.addEventListener(
        'touchstart',
        (event) => {
            if (event.touches.length !== 1) {
                finish();
                return;
            }
            if (!canStart(event.target)) {
                return;
            }
            const touch = event.touches[0];
            begin(touch.clientX, touch.clientY);
            touchId = touch.identifier;
            holdTimer = setTimeout(activate, 450);
        },
        { signal, passive: true }
    );
    document.addEventListener(
        'touchmove',
        (event) => {
            const touch = Array.from(event.touches).find((item) => item.identifier === touchId);
            if (!touch) {
                return;
            }
            if (!active) {
                if (Math.hypot(touch.clientX - startX, touch.clientY - startY) >= 8) {
                    finish();
                }
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            move(touch.clientX, touch.clientY);
        },
        { signal, capture: true, passive: false }
    );
    for (const type of ['touchend', 'touchcancel'] as const) {
        document.addEventListener(
            type,
            (event) => {
                if (
                    !Array.from(event.changedTouches).some((touch) => touch.identifier === touchId)
                ) {
                    return;
                }
                if (active) {
                    event.preventDefault();
                    event.stopPropagation();
                }
                finish();
            },
            { signal, capture: true, passive: false }
        );
    }
    panel.addEventListener(
        'click',
        (event) => {
            if (suppressClick) {
                event.preventDefault();
                event.stopImmediatePropagation();
            }
        },
        { signal, capture: true }
    );
    panel.addEventListener(
        'contextmenu',
        (event) => {
            if (active) {
                event.preventDefault();
            }
        },
        { signal }
    );
    window.addEventListener('blur', finish, { signal });
    window.addEventListener(
        'resize',
        () => {
            finish();
            constrain();
        },
        { signal }
    );
    const observer = new ResizeObserver(() => {
        if (!active && (x !== 0 || y !== 0)) {
            constrain();
        }
    });
    observer.observe(panel);

    return () => {
        finish();
        clearTimeout(clickTimer);
        listeners.abort();
        observer.disconnect();
        panel.classList.remove('movable-panel');
        panel.style.transform = originalTransform;
    };
}

export const vMovablePanel: ObjectDirective<HTMLElement> = {
    mounted(panel) {
        cleanups.set(panel, makeMovable(panel));
    },
    beforeUnmount(panel) {
        cleanups.get(panel)?.();
        cleanups.delete(panel);
    }
};
