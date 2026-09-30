import { createApp, h, nextTick, reactive, type App } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import GroupVisibilityButton from '../../src/components/panels/group/GroupVisibilityButton.vue';
import GroupsMasterVisibilityToggle from '../../src/components/panels/group/GroupsMasterVisibilityToggle.vue';

let app: App | null = null;
let container: HTMLElement | null = null;

function mount(render: () => ReturnType<typeof h>): HTMLElement {
    container = document.createElement('div');
    document.body.appendChild(container);
    app = createApp({ render });
    app.mount(container);
    return container;
}

function describedBy(button: HTMLElement): string {
    const id = button.getAttribute('aria-describedby');
    return id ? (document.getElementById(id)?.textContent ?? '') : '';
}

describe('GroupVisibilityButton', () => {
    afterEach(() => {
        app?.unmount();
        container?.remove();
        app = null;
        container = null;
    });

    function mountButton(props: Record<string, unknown>) {
        const root = mount(() => h(GroupVisibilityButton, { groupName: 'Proposal', ...props }));
        return root.querySelector('button') as HTMLButtonElement;
    }

    it('names the next action and describes the current state for each visibility state', () => {
        const visible = mountButton({ hidden: false, canSolo: true });
        expect(visible.getAttribute('aria-label')).toBe('Hide group Proposal');
        expect(describedBy(visible)).toBe('Visible');
        expect(visible.dataset.visibility).toBe('visible');
        app?.unmount();
        container?.remove();

        const hidden = mountButton({ hidden: true, canSolo: true });
        expect(hidden.getAttribute('aria-label')).toBe('Show only group Proposal');
        expect(describedBy(hidden)).toBe('Hidden');
        expect(hidden.dataset.visibility).toBe('hidden');
        app?.unmount();
        container?.remove();

        const emptyHidden = mountButton({ hidden: true, canSolo: false });
        expect(emptyHidden.getAttribute('aria-label')).toBe('Show group Proposal');
    });

    it('tells assistive technology which group is isolated while every eye offers show-all', () => {
        const root = mount(() =>
            h('div', [
                h(GroupVisibilityButton, {
                    groupName: 'Proposal',
                    hidden: false,
                    solo: true,
                    soloActive: true,
                    canSolo: true
                }),
                h(GroupVisibilityButton, {
                    groupName: 'Other',
                    hidden: true,
                    solo: false,
                    soloActive: true,
                    canSolo: true
                })
            ])
        );
        const [isolated, excluded] = Array.from(root.querySelectorAll('button'));

        expect(isolated.getAttribute('aria-label')).toBe('Show all groups');
        expect(excluded.getAttribute('aria-label')).toBe('Show all groups');
        expect(describedBy(isolated)).toBe('Showing only this group');
        expect(describedBy(excluded)).toBe('Hidden');
        expect(isolated.dataset.visibility).toBe('solo');
    });

    it('gives each button its own state description element', () => {
        const root = mount(() =>
            h('div', [
                h(GroupVisibilityButton, { groupName: 'A', hidden: false }),
                h(GroupVisibilityButton, { groupName: 'B', hidden: false })
            ])
        );
        const [first, second] = Array.from(root.querySelectorAll('button'));

        expect(first.getAttribute('aria-describedby')).not.toBe(
            second.getAttribute('aria-describedby')
        );
    });
});

describe('GroupsMasterVisibilityToggle', () => {
    afterEach(() => {
        app?.unmount();
        container?.remove();
        app = null;
        container = null;
    });

    it('keeps a stable name and exposes solo as the native mixed state', async () => {
        const state = reactive({ allHidden: false, soloActive: true });
        const root = mount(() => h(GroupsMasterVisibilityToggle, { ...state }));
        const input = root.querySelector('input') as HTMLInputElement;

        expect(input.getAttribute('aria-label')).toBe('Hide all groups');
        expect(input.hasAttribute('aria-checked')).toBe(false);
        expect(input.indeterminate).toBe(true);

        state.soloActive = false;
        state.allHidden = true;
        await nextTick();
        expect(input.getAttribute('aria-label')).toBe('Hide all groups');
        expect(input.indeterminate).toBe(false);
        expect(input.checked).toBe(true);
    });

    it('resynchronises the checkbox after leaving solo, where the bound checked value is unchanged', async () => {
        const state = reactive({ allHidden: false, soloActive: true });
        const onToggle = vi.fn(() => {
            state.soloActive = false;
        });
        const root = mount(() => h(GroupsMasterVisibilityToggle, { ...state, onToggle }));
        const input = root.querySelector('input') as HTMLInputElement;

        input.click();
        await nextTick();
        await nextTick();

        expect(onToggle).toHaveBeenCalledOnce();
        expect(input.checked).toBe(false);
        expect(input.indeterminate).toBe(false);
    });
});
