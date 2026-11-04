import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, nextTick } from 'vue';
import { createPinia } from 'pinia';
import ImageCopyStatus from '../../src/components/controls/ImageCopyStatus.vue';
import { useUiStore } from '../../src/stores/uiStore';

describe('image copy status', () => {
    afterEach(() => {
        vi.useRealTimers();
        document.body.replaceChildren();
    });

    it('announces a successful copy and clears the notice after four seconds', async () => {
        vi.useFakeTimers();
        const pinia = createPinia();
        const app = createApp(ImageCopyStatus);
        const container = document.createElement('div');
        document.body.append(container);
        app.use(pinia).mount(container);
        const ui = useUiStore(pinia);

        ui.setImageCopied(true);
        await nextTick();
        expect(container.querySelector('[role="status"]')?.textContent).toContain(
            'Map image copied to clipboard.'
        );
        vi.advanceTimersByTime(4000);
        await nextTick();
        expect(ui.imageCopied).toBe(false);
        expect(container.textContent).not.toContain('Map image copied');
        app.unmount();
    });
});
