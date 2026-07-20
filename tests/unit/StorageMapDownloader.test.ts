import { describe, expect, it, vi } from 'vitest';
import { StorageMapDownloader } from '../../src/features/map/StorageMapDownloader';

function createDownloader(
    overrides: Partial<ConstructorParameters<typeof StorageMapDownloader>[0]> = {}
) {
    const options: ConstructorParameters<typeof StorageMapDownloader>[0] = {
        loadLastMapSelected: vi.fn().mockResolvedValue('Selected map'),
        getCurrentTitle: vi.fn().mockReturnValue('Current map'),
        loadRawMapFromStorage: vi.fn().mockResolvedValue({ title: 'Selected map' }),
        showErrors: vi.fn(),
        ...overrides
    };

    return { downloader: new StorageMapDownloader(options), options };
}

describe('StorageMapDownloader', () => {
    it('downloads the selected stored record', async () => {
        const state = createDownloader();
        vi.useFakeTimers();
        const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
        const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
        const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

        await state.downloader.download();

        expect(state.options.loadRawMapFromStorage).toHaveBeenCalledWith('Selected map');
        expect(createObjectURL).toHaveBeenCalledOnce();
        expect(click).toHaveBeenCalledOnce();
        expect(revokeObjectURL).not.toHaveBeenCalled();
        vi.runAllTimers();
        expect(revokeObjectURL).toHaveBeenCalledWith('blob:test');
        vi.useRealTimers();
    });

    it('falls back to the current title when no map is selected', async () => {
        const state = createDownloader({
            loadLastMapSelected: vi.fn().mockResolvedValue(''),
            getCurrentTitle: vi.fn().mockReturnValue('Current map')
        });

        await state.downloader.download();

        expect(state.options.loadRawMapFromStorage).toHaveBeenCalledWith('Current map');
    });

    it('reports storage and preparation errors', async () => {
        const storageState = createDownloader({
            loadRawMapFromStorage: vi.fn().mockRejectedValue({ message: 'broken', stack: 'stack' })
        });
        await storageState.downloader.download();
        expect(storageState.options.showErrors).toHaveBeenCalledWith([
            'There was a problem loading the map from browser storage:',
            'broken',
            'stack'
        ]);

        const preparationState = createDownloader();
        vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
            throw new Error('blob failed');
        });
        await preparationState.downloader.download();
        expect(preparationState.options.showErrors).toHaveBeenCalledWith(
            expect.arrayContaining([
                'There was a problem preparing the map download:',
                'blob failed'
            ])
        );
    });
});
