import DOMPurify from 'dompurify';

export const GROUP_DESCRIPTION_MAX_LENGTH = 500;

const ALLOWED_TAGS = [
    'a',
    'blockquote',
    'br',
    'code',
    'em',
    'h3',
    'h4',
    'li',
    'ol',
    'p',
    'pre',
    'strong',
    'u',
    'ul'
];

const ALLOWED_ATTR = ['href', 'title', 'target', 'rel'];
const SAFE_URI_REGEXP = /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i;

export function sanitizeGroupDescription(raw: string | null | undefined): string {
    if (!raw) {
        return '';
    }

    const cappedSource = raw.slice(0, GROUP_DESCRIPTION_MAX_LENGTH);
    return DOMPurify.sanitize(cappedSource, {
        ALLOWED_TAGS,
        ALLOWED_ATTR,
        ALLOW_DATA_ATTR: false,
        FORBID_ATTR: ['style', 'class', 'id'],
        FORBID_TAGS: ['form', 'img', 'iframe', 'audio', 'video', 'object', 'embed', 'style'],
        ALLOWED_URI_REGEXP: SAFE_URI_REGEXP
    });
}

export function normalizeGroupDescription(raw: string | null | undefined): string | undefined {
    const sanitized = sanitizeGroupDescription(raw);
    return sanitized || undefined;
}
