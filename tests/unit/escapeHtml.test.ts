import { describe, expect, it } from 'vitest';
import { escapeHtml } from '../../src/services/escapeHtml';

describe('escapeHtml', () => {
    it('escapes all HTML-significant characters', () => {
        expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;');
    });

    it('returns unchanged text when no escapable characters are present', () => {
        expect(escapeHtml('Safer Street Maker')).toBe('Safer Street Maker');
    });

    it('coerces nullish values to empty string', () => {
        expect(escapeHtml(null)).toBe('');
        expect(escapeHtml(undefined)).toBe('');
    });

    it('coerces non-string values before escaping', () => {
        expect(escapeHtml(123)).toBe('123');
        expect(escapeHtml(true)).toBe('true');
        expect(escapeHtml({ toString: () => '<tag>' })).toBe('&lt;tag&gt;');
    });
});
