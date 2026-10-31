/**
 * Unit tests for layer helpers — feature action popups.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('leaflet', () => import('./__mocks__/leaflet'));

import { buildFeatureActionPopup } from '../../src/composables/layers/features/featureActionPopup';
import { disposePopupElement } from '../../src/composables/layers/features/featureGroupMembershipPopup';
import { useGroupStore } from '../../src/stores/groupStore';
import { pinia } from '../../src/stores';
import { useSelectionStore } from '../../src/stores/selectionStore';

beforeEach(() => {
    document.getElementById('map')?.remove();
    document.querySelector('.leaflet-mouse-marker')?.remove();
    vi.clearAllMocks();
    useGroupStore(pinia).setGroups([]);
    useSelectionStore(pinia).deactivate();
});

describe('feature popups', () => {
    const member = { layerId: 'ModalFilters', historyId: 'filter-1' };

    function getPopupContent(popup: any): HTMLElement {
        return popup.setContent.mock.calls[0][0] as HTMLElement;
    }

    it('renders group version counts and action controls', () => {
        useGroupStore(pinia).setGroups([
            {
                id: 'g1',
                name: 'Town centre',
                versions: [
                    { id: 'v1', name: 'Current', members: [member] },
                    { id: 'v2', name: 'Alternative', members: [member] }
                ]
            }
        ]);
        const map = { closePopup: vi.fn() } as any;
        const onCopy = vi.fn();
        const onDelete = vi.fn();
        const onOpenGroup = vi.fn();
        const onRemoveFromGroup = vi.fn();

        const popup = buildFeatureActionPopup({
            map,
            popupOptions: { minWidth: 30 },
            member,
            onCopy,
            onDelete,
            onOpenGroup,
            onRemoveFromGroup
        }) as any;
        const content = getPopupContent(popup);

        expect(content.querySelector('.group-link')?.textContent).toBe('Town centre (2 versions)');
        expect(content.children[0].classList.contains('popup-buttons')).toBe(true);
        expect(content.children[1].classList.contains('feature-popup-groups')).toBe(true);
        expect(content.querySelector('.remove-feature-button')).not.toBeNull();
        expect(content.querySelector('.copy-button')).not.toBeNull();
        expect(content.querySelector('.delete-button')).not.toBeNull();

        (content.querySelector('.group-link') as HTMLElement).click();
        (content.querySelector('.remove-feature-button') as HTMLElement).click();
        (content.querySelector('.copy-button') as HTMLElement).click();
        (content.querySelector('ul.popup-buttons > li > .delete-button') as HTMLElement).click();

        expect(onOpenGroup).toHaveBeenCalledWith('g1');
        expect(onRemoveFromGroup).toHaveBeenCalledWith('g1');
        expect(onCopy).toHaveBeenCalledOnce();
        expect(onDelete).toHaveBeenCalledOnce();
        expect(map.closePopup).toHaveBeenCalledTimes(2);

        disposePopupElement(content.querySelector('.copy-button')?.parentElement);
        disposePopupElement(content.querySelector('.copy-button')?.parentElement);
        (content.querySelector('.copy-button') as HTMLElement).click();
        expect(onCopy).toHaveBeenCalledOnce();
    });

    it('saves an edited feature name on blur without closing the action popup', () => {
        const map = { closePopup: vi.fn() } as any;
        const onRename = vi.fn();
        const popup = buildFeatureActionPopup({
            map,
            popupOptions: { minWidth: 30 },
            member,
            name: 'Old name',
            onRename,
            onDelete: vi.fn()
        }) as any;
        const content = getPopupContent(popup);
        const input = content.querySelector('.name-editor') as HTMLInputElement;
        expect(input.value).toBe('Old name');
        expect(content.querySelector('.apply-name-button')).toBeNull();
        input.value = 'New name';
        input.dispatchEvent(new Event('blur'));

        expect(onRename).toHaveBeenCalledWith('New name');
        expect(map.closePopup).not.toHaveBeenCalled();
    });

    it('submitting the name field blurs it and saves without closing the popup', () => {
        const map = { closePopup: vi.fn() } as any;
        const onRename = vi.fn();
        const popup = buildFeatureActionPopup({
            map,
            popupOptions: {},
            member,
            onRename,
            onDelete: vi.fn()
        }) as any;
        const content = getPopupContent(popup);
        document.body.append(content);
        const input = content.querySelector('.name-editor') as HTMLInputElement;
        try {
            input.focus();
            input.value = 'Keyboard name';
            content.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
            expect(document.activeElement).not.toBe(input);
            expect(onRename).toHaveBeenCalledExactlyOnceWith('Keyboard name');
            expect(map.closePopup).not.toHaveBeenCalled();
        } finally {
            content.remove();
        }
    });
});
