/**
 * Escapes user-controlled strings for safe HTML rendering.
 */
export function escapeHtml(value: unknown): string {
    return String(value ?? '').replace(/[&<>"']/g, (char) => {
        const escapedChars: Record<string, string> = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
        };
        return escapedChars[char] ?? char;
    });
}
