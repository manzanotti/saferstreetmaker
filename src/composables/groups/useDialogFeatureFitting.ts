import { nextTick, onBeforeUnmount, watch, type WatchSource } from 'vue';

interface UseDialogFeatureFittingOptions {
    isOpen: WatchSource<boolean>;
    getDialogElement: () => Element | null | undefined;
    fitFeatures: () => void;
}

/**
 * Fits map features above a docked dialog when it opens and whenever it resizes,
 * disconnecting the observer when the dialog closes or the component unmounts.
 */
export function useDialogFeatureFitting(options: UseDialogFeatureFittingOptions) {
    let resizeObserver: ResizeObserver | null = null;

    function disconnect() {
        resizeObserver?.disconnect();
        resizeObserver = null;
    }

    watch(
        options.isOpen,
        (open) => {
            disconnect();
            if (!open) {
                return;
            }
            void nextTick(() => {
                const dialogElement = options.getDialogElement();
                if (!dialogElement) {
                    return;
                }
                options.fitFeatures();
                resizeObserver = new ResizeObserver(() => options.fitFeatures());
                resizeObserver.observe(dialogElement);
            });
        },
        { immediate: true }
    );

    onBeforeUnmount(() => resizeObserver?.disconnect());
}
