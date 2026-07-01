import { describe, expect, it } from 'vitest';
import { Settings } from '../../../src/models/Settings';
import { FileManager } from '../../../src/services/FileManager';
import type { IMapLayer } from '../../../src/composables/layers/IMapLayer';

function makeSettings(title: string): Settings {
    const settings = new Settings();
    settings.title = title;
    return settings;
}

describe('history snapshot flow', () => {
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
