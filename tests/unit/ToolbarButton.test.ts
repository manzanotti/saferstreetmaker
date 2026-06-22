import { describe, it, expect } from 'vitest';
import type { ToolbarButton } from '../../src/models/ToolbarButton';

describe('ToolbarButton', () => {
    it('can be created as a plain object satisfying the interface', () => {
        const handler = () => {};
        const btn: ToolbarButton = {
            id: 'modal-filter',
            text: 'MF',
            tooltip: 'Add modal filters',
            selected: true,
            groupName: 'filters',
            action: handler,
            isFirst: true,
        };

        expect(btn.id).toBe('modal-filter');
        expect(btn.text).toBe('MF');
        expect(btn.tooltip).toBe('Add modal filters');
        expect(btn.selected).toBe(true);
        expect(btn.groupName).toBe('filters');
        expect(btn.action).toBe(handler);
        expect(btn.isFirst).toBe(true);
    });

    it('can hold a nested buttons array', () => {
        const noop = () => {};
        const child: ToolbarButton = {
            id: 'child',
            tooltip: '',
            selected: false,
            groupName: '',
            action: noop,
        };
        const parent: ToolbarButton = {
            id: 'parent',
            tooltip: '',
            selected: false,
            groupName: '',
            action: noop,
            buttons: [child],
        };

        expect(parent.buttons).toHaveLength(1);
        expect(parent.buttons![0].id).toBe('child');
    });

    it('optional properties are absent when not provided', () => {
        const noop = () => {};
        const btn: ToolbarButton = {
            id: 'x',
            tooltip: 'x',
            selected: false,
            groupName: '',
            action: noop,
        };
        expect(btn.text).toBeUndefined();
        expect(btn.isFirst).toBeUndefined();
        expect(btn.buttons).toBeUndefined();
    });
});
