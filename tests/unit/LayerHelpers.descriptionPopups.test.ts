/**
 * Unit tests for layer helpers — feature description popups.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('leaflet', () => import('./__mocks__/leaflet'));

import { buildFeatureDescriptionPopup } from '../../src/composables/layers/features/featureDescriptionPopup';
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

    it('does not build a popup for an unnamed feature without groups', () => {
        const popup = buildFeatureDescriptionPopup({ minWidth: 30 }, member, 'hover', {
            iconSrc: '/icons/modal.svg'
        });

        expect(popup).toBeNull();
    });

    it('renders every available group description in a description popup', () => {
        useGroupStore(pinia).setGroups([
            {
                id: 'g1',
                name: 'Town centre',
                description: '<p>Slow <strong>traffic</strong></p>',
                members: [member]
            },
            {
                id: 'g2',
                name: 'School route',
                description: '<p>Protect crossings</p>',
                members: [member]
            },
            { id: 'g3', name: 'No notes', members: [member] }
        ]);

        const popup = buildFeatureDescriptionPopup({ minWidth: 30 }, member) as any;
        const content = getPopupContent(popup);

        expect(content.textContent).toContain('Town centre');
        expect(content.textContent).toContain('Slow traffic');
        expect(content.textContent).toContain('School route');
        expect(content.textContent).toContain('Protect crossings');
        expect(content.textContent).toContain('No notes');
        expect(content.querySelectorAll('.feature-popup-group-description')).toHaveLength(3);
        expect(content.querySelectorAll('.feature-popup-description')).toHaveLength(2);
        expect(popup.options.autoClose).toBe(false);
        expect(popup.options.autoPan).toBe(false);
        expect(popup.options.className).toBe('feature-popup-hover');
    });

    it('uses a separate class for interactive click description popups', () => {
        useGroupStore(pinia).setGroups([
            {
                id: 'g1',
                name: 'Town centre',
                description: '<a href="/details">View details</a>',
                members: [member]
            }
        ]);

        const popup = buildFeatureDescriptionPopup({ minWidth: 30 }, member, 'click') as any;

        expect(popup.options.autoPan).toBe(true);
        expect(popup.options.className).toBe('feature-popup-description');
        expect(popup.options.className).not.toBe('feature-popup-hover');
    });

    it('renders interactive group headings as non-submit buttons', () => {
        useGroupStore(pinia).setGroups([
            {
                id: 'g1',
                name: 'Town centre',
                members: [member]
            }
        ]);

        const onOpenGroup = vi.fn();
        const popup = buildFeatureDescriptionPopup({ minWidth: 30 }, member, 'hover', {
            onOpenGroup
        }) as any;
        const heading = getPopupContent(popup).querySelector('.group-link') as HTMLButtonElement;

        expect(heading.type).toBe('button');
        heading.click();
        expect(onOpenGroup).toHaveBeenCalledExactlyOnceWith('g1');
    });

    it('orders toolbar icon, feature name, and group content', () => {
        useGroupStore(pinia).setGroups([
            {
                id: 'g1',
                name: 'Town centre',
                description: '<p>Slow traffic</p>',
                members: [member]
            }
        ]);

        const popup = buildFeatureDescriptionPopup({ minWidth: 30 }, member, 'hover', {
            featureName: 'Main crossing',
            iconSrc: '/icons/modal.svg'
        }) as any;
        const content = getPopupContent(popup);

        expect(content.children[0].classList.contains('feature-popup-feature-icon')).toBe(true);
        expect((content.children[0] as HTMLImageElement).alt).toBe('Modal filter');
        expect(content.children[1].classList.contains('feature-popup-feature-name')).toBe(true);
        expect(content.children[1].textContent).toBe('Main crossing');
        expect(content.children[2].classList.contains('feature-popup-group-description')).toBe(
            true
        );
        expect(content.children[2].textContent).toContain('Town centre');
    });

    it('renders toolbar-style text in the popup', () => {
        const popup = buildFeatureDescriptionPopup({ minWidth: 30 }, member, 'hover', {
            featureName: 'Cell',
            text: 'LTN'
        }) as any;
        const text = getPopupContent(popup).children[0];

        expect(text.tagName).toBe('SPAN');
        expect(text.classList.contains('feature-popup-feature-text')).toBe(true);
        expect(text.classList.contains('text-xl')).toBe(true);
        expect(text.classList.contains('font-bold')).toBe(true);
        expect(text.textContent).toBe('LTN');
    });

    it('does not build a description popup for an ungrouped feature', () => {
        const popup = buildFeatureDescriptionPopup({ minWidth: 30 }, member);

        expect(popup).toBeNull();
    });
});
