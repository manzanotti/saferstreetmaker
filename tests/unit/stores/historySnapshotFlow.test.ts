import { describe, expect, it, vi } from 'vitest';
import Dexie from 'dexie';
import LZString from 'lz-string';
import { Settings } from '../../../src/models/Settings';
import { FileManager } from '../../../src/services/FileManager';
import type { IMapLayer } from '../../../src/composables/layers/IMapLayer';

function makeSettings(title: string): Settings {
    const settings = new Settings();
    settings.title = title;
    return settings;
}

describe('history snapshot flow', () => {
    it('initialises without browser localStorage', async () => {
        vi.stubGlobal('localStorage', undefined);

        try {
            const fileManager = new FileManager();
            await expect(fileManager.loadLastMapSelected()).resolves.toBe('');
        } finally {
            vi.unstubAllGlobals();
        }
    });

    it('does not complete legacy migration when localStorage cannot be inspected', async () => {
        await Dexie.delete('SaferStreetMakerDB');
        const legacyMap = {
            settings: {
                title: 'RetryCity',
                readOnly: false,
                hideToolbar: false,
                activeLayers: [],
                centre: null,
                zoom: 12,
                version: '0.8.1'
            },
            layers: {},
            lastSaved: '2026-06-22T00:00:00.000Z'
        };
        let inspectionFailed = true;
        const getItem = vi.fn((key: string) => {
            if (inspectionFailed) {
                inspectionFailed = false;
                throw new DOMException('Storage is blocked', 'SecurityError');
            }
            return (
                {
                    MapList: LZString.compress(JSON.stringify(['RetryCity'])),
                    LastMapSelected: LZString.compress('RetryCity'),
                    Map_RetryCity: LZString.compress(JSON.stringify(legacyMap))
                }[key] ?? null
            );
        });
        vi.stubGlobal('localStorage', { getItem });

        try {
            const fileManager = new FileManager();
            await expect(fileManager.loadLastMapSelected()).resolves.toBe('');

            const retryingFileManager = new FileManager();
            await expect(retryingFileManager.loadLastMapSelected()).resolves.toBe('RetryCity');
            await expect(
                retryingFileManager.loadMapFromStorage('RetryCity')
            ).resolves.toMatchObject({ settings: { title: 'RetryCity', version: '0.8.1' } });
        } finally {
            vi.unstubAllGlobals();
        }
    });

    it('builds different snapshots when only the title changes', () => {
        const fileManager = new FileManager();
        const layers = new Map<string, IMapLayer>();

        const before = fileManager.buildSerializedMap(makeSettings('Hello Cleveland'), layers);
        const after = fileManager.buildSerializedMap(makeSettings('Saved Title'), layers);

        expect(before.settings?.title).toBe('Hello Cleveland');
        expect(after.settings?.title).toBe('Saved Title');
        expect(JSON.stringify(before)).not.toBe(JSON.stringify(after));
    });
});
