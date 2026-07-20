import { describe, expect, it, vi } from 'vitest';
import { UploadedMapLoader } from '../../src/features/map/UploadedMapLoader';

function createLoader(overrides: Partial<ConstructorParameters<typeof UploadedMapLoader>[0]> = {}) {
    const options: ConstructorParameters<typeof UploadedMapLoader>[0] = {
        closePanel: vi.fn(),
        clearAndReset: vi.fn(),
        loadMapData: vi.fn().mockReturnValue(true),
        saveMap: vi.fn().mockResolvedValue(undefined),
        showErrors: vi.fn(),
        ...overrides
    };
    return { loader: new UploadedMapLoader(options), options };
}

describe('UploadedMapLoader', () => {
    it('closes, resets, loads, and saves a valid uploaded map', () => {
        const state = createLoader();
        const data = { layers: {} };

        state.loader.load(data);

        expect(state.options.closePanel).toHaveBeenCalledOnce();
        expect(state.options.clearAndReset).toHaveBeenCalledOnce();
        expect(state.options.loadMapData).toHaveBeenCalledWith(data);
        expect(state.options.saveMap).toHaveBeenCalledOnce();
        expect(state.options.showErrors).not.toHaveBeenCalled();
    });

    it('does not save when uploaded data is rejected', () => {
        const state = createLoader({ loadMapData: vi.fn().mockReturnValue(false) });

        state.loader.load(null);

        expect(state.options.saveMap).not.toHaveBeenCalled();
        expect(state.options.showErrors).not.toHaveBeenCalled();
    });

    it('reports save errors from a successfully loaded upload', async () => {
        const failure = new Error('Save unavailable');
        const state = createLoader({
            saveMap: vi.fn().mockRejectedValue(failure)
        });

        state.loader.load({ layers: {} });
        await Promise.resolve();

        expect(state.options.showErrors).toHaveBeenCalledWith([
            'There was a problem saving the map:',
            'Save unavailable',
            failure.stack
        ]);
    });

    it('reports load errors with the original message and stack', () => {
        const failure = new Error('Invalid uploaded map');
        const state = createLoader({
            loadMapData: vi.fn().mockImplementation(() => {
                throw failure;
            })
        });

        state.loader.load({});

        expect(state.options.showErrors).toHaveBeenCalledWith([
            'There was a problem loading the map from uploaded file:',
            'Invalid uploaded map',
            failure.stack
        ]);
        expect(state.options.saveMap).not.toHaveBeenCalled();
    });
});
