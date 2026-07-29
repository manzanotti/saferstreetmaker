import { describe, expect, it } from 'vitest';
import {
    GROUP_DESCRIPTION_MAX_LENGTH,
    normalizeGroupDescription,
    sanitizeGroupDescription
} from '../../src/features/groups/groupDescription';

describe('group description policy', () => {
    it('preserves basic formatting and safe links', () => {
        const result = sanitizeGroupDescription(
            '<h3>School zone</h3><p><strong>Slow down</strong> <em>today</em>.</p><ul><li><a href="https://example.com" title="More">Details</a></li></ul>'
        );

        expect(result).toContain('<h3>School zone</h3>');
        expect(result).toContain('<strong>Slow down</strong>');
        expect(result).toContain('<em>today</em>');
        expect(result).toContain('<a href="https://example.com" title="More">Details</a>');
    });

    it('removes active content, unsafe attributes, and unsafe links', () => {
        const result = sanitizeGroupDescription(
            '<p onclick="alert(1)">Hello<img src="x"><script>alert(1)</script><a href="javascript:alert(1)" target="_blank" rel="noopener">bad</a></p>'
        );

        expect(result).toBe('<p>Hello<a>bad</a></p>');
        expect(result).not.toContain('onclick');
        expect(result).not.toContain('<img');
        expect(result).not.toContain('<script');
        expect(result).not.toContain('javascript:');
        expect(result).not.toContain('target=');
        expect(result).not.toContain('rel=');
        expect(result).not.toContain('style=');
    });

    it('caps the raw source before sanitizing', () => {
        const result = sanitizeGroupDescription(`${'<strong>x</strong>'.repeat(100)}tail`);

        expect(result).not.toContain('tail');
        expect(sanitizeGroupDescription('x'.repeat(GROUP_DESCRIPTION_MAX_LENGTH + 1))).toBe(
            'x'.repeat(GROUP_DESCRIPTION_MAX_LENGTH)
        );
    });

    it('normalizes empty or unsafe-only descriptions to undefined', () => {
        expect(normalizeGroupDescription('')).toBeUndefined();
        expect(normalizeGroupDescription('<script>alert(1)</script>')).toBeUndefined();
    });
});
