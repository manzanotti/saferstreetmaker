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
            ref(false),
            shareScopeGroup
        );

        createShare('group', undefined);

        expect(getFileManager).not.toHaveBeenCalled();
        expect(showCopiedMessage.value).toBe(false);
    });
});
