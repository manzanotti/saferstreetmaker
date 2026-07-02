import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useUiStore } from '../../../src/stores/uiStore';
import type { PanelId } from '../../../src/stores/uiStore';

describe('uiStore', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
    });

    it('initialises with no active modal and no errors', () => {
        const store = useUiStore();
        expect(store.activePanel).toBeNull();
        expect(store.errorMessages).toEqual([]);
        expect(store.showDownloadStorageLink).toBe(false);
    });

    describe('openPanel() / closePanel()', () => {
        it('sets activePanel', () => {
            const store = useUiStore();
            store.openPanel('settings');
            expect(store.activePanel).toBe('settings');
        });

        it('switches to a different modal', () => {
            const store = useUiStore();
            store.openPanel('settings');
            store.openPanel('help');
            expect(store.activePanel).toBe('help');
        });

        it('closePanel() resets to null', () => {
            const store = useUiStore();
            store.openPanel('mapManager');
            store.closePanel();
            expect(store.activePanel).toBeNull();
        });

        const panels: PanelId[] = ['settings', 'mapManager', 'sharing', 'help'];
        panels.forEach((id) => {
            it(`accepts panel id '${id}'`, () => {
                const store = useUiStore();
                store.openPanel(id);
                expect(store.activePanel).toBe(id);
            });
        });
    });

    describe('showErrors() / clearErrors()', () => {
        it('stores error messages', () => {
            const store = useUiStore();
            store.showErrors(['Something went wrong', 'Details here']);
            expect(store.errorMessages).toEqual(['Something went wrong', 'Details here']);
            expect(store.showDownloadStorageLink).toBe(false);
        });

        it('replaces existing errors on subsequent calls', () => {
            const store = useUiStore();
            store.showErrors(['first']);
            store.showErrors(['second', 'third']);
            expect(store.errorMessages).toEqual(['second', 'third']);
        });

        it('clearErrors() empties the list', () => {
            const store = useUiStore();
            store.showErrors(['oops']);
            store.clearErrors();
            expect(store.errorMessages).toHaveLength(0);
            expect(store.showDownloadStorageLink).toBe(false);
        });

        it('sets showDownloadStorageLink from options', () => {
            const store = useUiStore();
            store.showErrors(['storage error'], { showDownloadStorageLink: true });

            expect(store.showDownloadStorageLink).toBe(true);
        });

        it('resets showDownloadStorageLink on subsequent showErrors without options', () => {
            const store = useUiStore();
            store.showErrors(['storage error'], { showDownloadStorageLink: true });
            store.showErrors(['generic error']);

            expect(store.showDownloadStorageLink).toBe(false);
        });
    });
});
