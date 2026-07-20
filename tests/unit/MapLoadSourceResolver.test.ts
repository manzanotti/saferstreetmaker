import { describe, expect, it, vi } from 'vitest';
import type { FileManager } from '../../src/services/FileManager';
import { MapLoadSourceResolver } from '../../src/features/map/MapLoadSourceResolver';

function createFileManager(overrides: Partial<FileManager> = {}): FileManager {
    return {
        loadMapFromRemoteFile: vi.fn(),
        loadMapFromHash: vi.fn(),
        loadLastMapSelected: vi.fn(),
        loadMapFromStorage: vi.fn(),
        ...overrides
    } as unknown as FileManager;
}

describe('MapLoadSourceResolver', () => {
    it('loads a remote map when a remote file is provided', async () => {
        const geoJSON = { title: 'Remote map' };
        const fileManager = createFileManager({
            loadMapFromRemoteFile: vi.fn().mockResolvedValue(geoJSON)
        });
        const resolver = new MapLoadSourceResolver(fileManager, () => 'Current map');

        const result = await resolver.resolve('/maps/remote.json', '');

        expect(fileManager.loadMapFromRemoteFile).toHaveBeenCalledWith('/maps/remote.json');
        expect(result).toMatchObject({
            geoJSON,
            loadingFromStorage: false,
            storageMapName: ''
        });
    });

    it('decodes the hash without the leading hash marker', async () => {
        const geoJSON = { title: 'Shared map' };
        const fileManager = createFileManager({
            loadMapFromHash: vi.fn().mockReturnValue(geoJSON)
        });
        const resolver = new MapLoadSourceResolver(fileManager, () => 'Current map');

        const result = await resolver.resolve(null, '#encoded-map');

        expect(fileManager.loadMapFromHash).toHaveBeenCalledWith('encoded-map');
        expect(result.geoJSON).toBe(geoJSON);
    });

    it('uses the last selected map or the current title for storage loading', async () => {
        const fileManager = createFileManager({
            loadLastMapSelected: vi.fn().mockResolvedValue('Last map'),
            loadMapFromStorage: vi.fn().mockResolvedValue({ title: 'Last map' })
        });
        const resolver = new MapLoadSourceResolver(fileManager, () => 'Current map');

        const result = await resolver.resolve(null, '');

        expect(fileManager.loadMapFromStorage).toHaveBeenCalledWith('Last map');
        expect(result).toMatchObject({ loadingFromStorage: true, storageMapName: 'Last map' });
    });

    it('falls back to the current title when no map was previously selected', async () => {
        const fileManager = createFileManager({
            loadLastMapSelected: vi.fn().mockResolvedValue(null),
            loadMapFromStorage: vi.fn().mockResolvedValue(null)
        });
        const resolver = new MapLoadSourceResolver(fileManager, () => 'Current map');

        await resolver.resolve(null, '');

        expect(fileManager.loadMapFromStorage).toHaveBeenCalledWith('Current map');
    });
});
