/**
 * Unit tests for layer helpers — read-only group, delete and membership popups.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('leaflet', () => import('./__mocks__/leaflet'));

import { buildDeletePopup } from '../../src/composables/layers/features/featureActionPopup';
import {
    buildReadOnlyGroupPopup,
    getReadOnlyGroupCenter
} from '../../src/composables/layers/features/readOnlyGroupPopup';
import {
    buildFeatureGroupMembershipContent,
    disposePopupElement
} from '../../src/composables/layers/features/featureGroupMembershipPopup';
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

describe('buildReadOnlyGroupPopup', () => {
    it('returns null when the group is missing', () => {
        expect(buildReadOnlyGroupPopup('missing')).toBeNull();
    });

    it('renders distinct feature counts across versions and opens group details', () => {
        useGroupStore(pinia).setGroups([
            {
                id: 'g1',
                name: 'Neighbourhood',
                description: '<p>Safer routes</p>',
                versions: [
                    {
                        id: 'v1',
                        name: 'Current',
                        members: [{ layerId: 'ModalFilters', historyId: 'f1' }]
                    },
                    {
                        id: 'v2',
                        name: 'Proposed',
                        members: [
                            { layerId: 'ModalFilters', historyId: 'f1' },
                            { layerId: 'BusGates', historyId: 'b1' }
                        ]
                    }
                ]
            }
        ]);
        const onOpenGroup = vi.fn();
        const popup = buildReadOnlyGroupPopup('g1', onOpenGroup) as any;
        const content = popup.setContent.mock.calls[0][0] as HTMLElement;
        const heading = content.querySelector('.group-link') as HTMLButtonElement;

        expect(popup.options.className).toBe('group-popup');
        expect(heading.type).toBe('button');
        expect(heading.getAttribute('aria-label')).toBe('Open group Neighbourhood');
        expect(content.querySelector('.feature-popup-description')?.textContent).toBe(
            'Safer routes'
        );
        expect(content.querySelector('.group-popup-summary')?.textContent).toBe(
            '2 features · 2 versions'
        );
        heading.click();
        expect(onOpenGroup).toHaveBeenCalledExactlyOnceWith('g1');
    });
});

describe('getReadOnlyGroupCenter', () => {
    it('returns null when the group is missing', () => {
        expect(getReadOnlyGroupCenter('missing')).toBeNull();
    });
});

describe('buildDeletePopup', () => {
    function getPopupContent(onDelete = vi.fn(), onCopy?: () => void) {
        const map = { closePopup: vi.fn() } as any;
        const popup = buildDeletePopup(map, { minWidth: 30 }, onDelete, onCopy) as any;
        const content = popup.setContent.mock.calls[0][0] as HTMLElement;
        return { map, popup, content };
    }

    it('renders only the delete control when copy is unavailable', () => {
        const { content } = getPopupContent();

        expect(content.tagName).toBe('UL');
        expect(content.querySelector('.copy-button')).toBeNull();
        expect(content.querySelectorAll('li > .delete-button')).toHaveLength(1);
    });

    it('renders accessible copy and delete controls when copy is enabled', () => {
        const { content } = getPopupContent(vi.fn(), vi.fn());
        const items = content.querySelectorAll('li');
        const controls = content.querySelectorAll('button');

        expect(items).toHaveLength(2);
        expect(controls).toHaveLength(2);
        expect(Array.from(content.children).every((child) => child.tagName === 'LI')).toBe(true);
        expect(controls[0].getAttribute('type')).toBe('button');
        expect(controls[0].getAttribute('aria-label')).toBe('Copy selected feature');
        expect(controls[1].getAttribute('type')).toBe('button');
        expect(controls[1].getAttribute('aria-label')).toBe('Delete selected feature');
    });

    it('activates copy on click and closes the popup', () => {
        const onCopy = vi.fn();
        const { map, content } = getPopupContent(vi.fn(), onCopy);
        const copyControl = content.querySelector('.copy-button') as HTMLElement;

        copyControl.click();

        expect(onCopy).toHaveBeenCalledOnce();
        expect(map.closePopup).toHaveBeenCalledOnce();
    });

    it('activates delete on click and closes the popup', () => {
        const onDelete = vi.fn();
        const { map, content } = getPopupContent(onDelete);
        const deleteControl = content.querySelector('.delete-button') as HTMLElement;

        deleteControl.click();

        expect(onDelete).toHaveBeenCalledOnce();
        expect(map.closePopup).toHaveBeenCalledOnce();
    });
});

describe('buildFeatureGroupMembershipContent', () => {
    const member = { layerId: 'ModalFilters', historyId: 'filter-1' };

    it('shows the create option before alphabetized existing groups', () => {
        useGroupStore(pinia).setGroups([
            { id: 'g2', name: 'Zebra Zone', members: [] },
            { id: 'g1', name: 'Alpha Zone', members: [] }
        ]);
        const onAddToGroup = vi.fn();
        const onCreateNewGroup = vi.fn();
        const content = buildFeatureGroupMembershipContent(
            member,
            undefined,
            undefined,
            onAddToGroup,
            onCreateNewGroup
        );

        expect(content.querySelector('.feature-popup-groups strong')?.textContent).toBe('Groups');
        expect(content.querySelector('.feature-popup-group-none')?.textContent).toBe('None');

        const groupSelect = content.querySelector(
            '.add-feature-to-group-select'
        ) as HTMLSelectElement;
        expect([...groupSelect.options].map((option) => option.textContent)).toEqual([
            'Add to group…',
            'Create new group…',
            'Alpha Zone',
            'Zebra Zone'
        ]);

        groupSelect.value = '__create-new-group__';
        groupSelect.dispatchEvent(new Event('change'));
        expect(onCreateNewGroup).toHaveBeenCalledWith(member, expect.any(Function));

        const refreshedGroupSelect = content.querySelector(
            '.add-feature-to-group-select'
        ) as HTMLSelectElement;
        refreshedGroupSelect.value = 'g1';
        refreshedGroupSelect.dispatchEvent(new Event('change'));
        expect(onAddToGroup).toHaveBeenCalledWith('g1');

        const currentGroupSelect = content.querySelector(
            '.add-feature-to-group-select'
        ) as HTMLSelectElement;
        disposePopupElement(content);
        currentGroupSelect.value = '__create-new-group__';
        currentGroupSelect.dispatchEvent(new Event('change'));
        groupSelect.value = '__create-new-group__';
        groupSelect.dispatchEvent(new Event('change'));
        expect(onCreateNewGroup).toHaveBeenCalledOnce();
    });
});
