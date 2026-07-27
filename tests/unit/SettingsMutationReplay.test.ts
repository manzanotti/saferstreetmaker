import { describe, expect, it } from 'vitest';
import {
    createSettingsMutationPayload,
    getSettingsMutationTarget
} from '../../src/features/history/settingsMutationReplay';

const before = {
    title: 'Before',
    readOnly: false,
    hideToolbar: false,
    activeLayers: ['ModalFilters'],
    centre: { lat: 52.5, lng: -1.9 },
    zoom: 12,
    version: '0.9.0'
};

const after = {
    title: 'After',
    readOnly: true,
    hideToolbar: true,
    activeLayers: ['LtnCells'],
    centre: null,
    zoom: 10,
    version: '0.9.1'
};

describe('settings mutation replay', () => {
    it('serializes settings into independent before and after snapshots', () => {
        const originalLayers = ['ModalFilters'];
        const payload = createSettingsMutationPayload(
            { ...before, activeLayers: originalLayers },
            after
        );

        originalLayers.push('LtnCells');

        expect(payload).toEqual({
            before: {
                title: before.title,
                readOnly: before.readOnly,
                hideToolbar: before.hideToolbar,
                activeLayers: before.activeLayers,
                version: before.version
            },
            after: {
                title: after.title,
                readOnly: after.readOnly,
                hideToolbar: after.hideToolbar,
                activeLayers: after.activeLayers,
                version: after.version
            }
        });
        expect(payload.before).not.toHaveProperty('centre');
        expect(payload.before).not.toHaveProperty('zoom');
        expect(payload.before?.activeLayers).not.toBe(originalLayers);
    });

    it('selects the before or after settings for the replay direction', () => {
        const payload = { before, after };

        expect(getSettingsMutationTarget(payload, 'undo')).toEqual(before);
        expect(getSettingsMutationTarget(payload, 'redo')).toEqual(after);
    });

    it('returns null when the requested side is missing', () => {
        expect(getSettingsMutationTarget({ before }, 'redo')).toBeNull();
        expect(getSettingsMutationTarget({ after }, 'undo')).toBeNull();
    });

    it('rejects malformed settings payloads instead of throwing during replay', () => {
        expect(
            getSettingsMutationTarget(
                {
                    before: { ...before, activeLayers: ['ModalFilters', 1] },
                    after
                },
                'undo'
            )
        ).toBeNull();
        expect(getSettingsMutationTarget(null, 'redo')).toBeNull();
    });
});
