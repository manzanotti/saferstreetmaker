/**
 * Unit tests for useDialogFeatureFitting — fitting features above docked dialogs.
 */
import { createApp, defineComponent, h, nextTick, ref } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDialogFeatureFitting } from '../../src/composables/groups/useDialogFeatureFitting';

const observers: FakeResizeObserver[] = [];

class FakeResizeObserver {
    observed: Element[] = [];
    disconnected = false;

    constructor(readonly callback: ResizeObserverCallback) {
        observers.push(this);
    }

    observe(element: Element) {
        this.observed.push(element);
    }

    unobserve() {}

    disconnect() {
        this.disconnected = true;
    }

    trigger() {
        this.callback([], this as unknown as ResizeObserver);
    }
}

describe('useDialogFeatureFitting', () => {
    let app: ReturnType<typeof createApp> | null = null;
    const isOpen = ref(false);
    const fitFeatures = vi.fn();

    function mount() {
        app = createApp(
            defineComponent({
                setup() {
                    const dialog = ref<HTMLDivElement | null>(null);
                    useDialogFeatureFitting({
                        isOpen,
                        getDialogElement: () => dialog.value,
                        fitFeatures
                    });
                    return () => (isOpen.value ? h('div', { ref: dialog }) : null);
                }
            })
        );
        app.mount(document.createElement('div'));
    }

    beforeEach(() => {
        observers.length = 0;
        isOpen.value = false;
        fitFeatures.mockReset();
        vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    });

    afterEach(() => {
        app?.unmount();
        app = null;
        vi.unstubAllGlobals();
    });

    it('does nothing while the dialog is closed', async () => {
        mount();
        await nextTick();
        expect(fitFeatures).not.toHaveBeenCalled();
        expect(observers).toHaveLength(0);
    });

    it('fits immediately when opened and again whenever the dialog resizes', async () => {
        isOpen.value = true;
        mount();
        await nextTick();

        expect(fitFeatures).toHaveBeenCalledTimes(1);
        expect(observers).toHaveLength(1);
        expect(observers[0].observed[0]).toBeInstanceOf(HTMLDivElement);

        observers[0].trigger();
        expect(fitFeatures).toHaveBeenCalledTimes(2);
    });

    it('disconnects when the dialog closes and observes again when reopened', async () => {
        mount();
        isOpen.value = true;
        await nextTick();
        await nextTick();
        expect(observers).toHaveLength(1);

        isOpen.value = false;
        await nextTick();
        expect(observers[0].disconnected).toBe(true);

        isOpen.value = true;
        await nextTick();
        await nextTick();
        expect(observers).toHaveLength(2);
        expect(fitFeatures).toHaveBeenCalledTimes(2);
    });

    it('disconnects the observer on unmount', async () => {
        isOpen.value = true;
        mount();
        await nextTick();

        app?.unmount();
        app = null;
        expect(observers[0].disconnected).toBe(true);
    });
});
