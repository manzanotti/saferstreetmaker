import { describe, it, expect } from 'vitest';
import { ToolbarButton } from '../../src/scripts/Controls/ToolbarButton';

describe('ToolbarButton', () => {
    it('can be instantiated with no arguments', () => {
        const btn = new ToolbarButton();
        expect(btn).toBeInstanceOf(ToolbarButton);
    });

    it('allows setting all properties', () => {
        const btn = new ToolbarButton();
        const handler = () => {};

        btn.id = 'modal-filter';
        btn.text = 'MF';
        btn.tooltip = 'Add modal filters';
        btn.selected = true;
        btn.groupName = 'filters';
        btn.action = handler;
        btn.isFirst = true;

        expect(btn.id).toBe('modal-filter');
        expect(btn.text).toBe('MF');
        expect(btn.tooltip).toBe('Add modal filters');
        expect(btn.selected).toBe(true);
        expect(btn.groupName).toBe('filters');
        expect(btn.action).toBe(handler);
        expect(btn.isFirst).toBe(true);
    });

    it('can hold a nested buttons array', () => {
        const parent = new ToolbarButton();
        const child = new ToolbarButton();
        child.id = 'child';
        parent.buttons = [child];

        expect(parent.buttons).toHaveLength(1);
        expect(parent.buttons[0].id).toBe('child');
    });

    it('defaults are all undefined', () => {
        const btn = new ToolbarButton();
        expect(btn.id).toBeUndefined();
        expect(btn.text).toBeUndefined();
        expect(btn.tooltip).toBeUndefined();
        expect(btn.selected).toBeUndefined();
        expect(btn.groupName).toBeUndefined();
        expect(btn.isFirst).toBeUndefined();
        expect(btn.buttons).toBeUndefined();
        expect(btn.action).toBeUndefined();
    });
});
