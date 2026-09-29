import { createPinia, setActivePinia } from 'pinia';
import { ref } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSharingGenerator } from '../../src/composables/useSharingGenerator';

const { getFileManager } = vi.hoisted(() => ({
    getFileManager: vi.fn()
}));

vi.mock('../../src/composables/useMapManager', () => ({
    getFileManager
}));

describe('useSharingGenerator', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        getFileManager.mockReset();
    });

    it('ignores a group share request without a group', () => {
        const shareScopeGroup = ref(null);
        const { createShare, showCopiedMessage } = useSharingGenerator(
            ref(320),
            ref(240),
            shareScopeGroup
        );

        createShare('group', undefined);

        expect(getFileManager).not.toHaveBeenCalled();
        expect(showCopiedMessage.value).toBe(false);
    });

    it('copies a direct URL without dimensions and preserves dimensions in iframe output', () => {
        const clipboardWrite = vi.fn().mockResolvedValue(undefined);
        const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText: clipboardWrite }
        });
        getFileManager.mockReturnValue({
            saveMapToHash: vi.fn(() => 'encoded-map')
        });

        try {
            const width = ref<number | null>(null);
            const height = ref<number | null>(null);
            const { createShare } = useSharingGenerator(width, height, ref(null));

            createShare('all', undefined, 'url');

            const directUrl = clipboardWrite.mock.calls[0][0] as string;
            expect(directUrl).toContain('share=1');
            expect(directUrl).toContain('#encoded-map');
            expect(directUrl).not.toContain('<iframe');

            width.value = 320;
            height.value = 240;
            createShare('all', undefined, 'html');

            const iframe = clipboardWrite.mock.calls[1][0] as string;
            expect(iframe).toContain('<iframe');
            expect(iframe).toContain('width="320"');
            expect(iframe).toContain('height="240"');
        } finally {
            if (clipboardDescriptor) {
                Object.defineProperty(navigator, 'clipboard', clipboardDescriptor);
            } else {
                delete (navigator as Partial<Navigator>).clipboard;
            }
        }
    });
});
