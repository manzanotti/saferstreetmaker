function clipboardWriteError(error: unknown): Error {
    if (
        typeof error === 'object' &&
        error !== null &&
        'name' in error &&
        error.name === 'NotAllowedError'
    ) {
        return new Error('Clipboard access was denied. Allow clipboard access and try again.');
    }
    const detail = error instanceof Error ? error.message : String(error);
    return new Error(`The image could not be copied to the clipboard: ${detail}`);
}

export function getPngClipboardWriter(): (image: Promise<Blob>) => Promise<void> {
    if (
        !window.isSecureContext ||
        typeof ClipboardItem !== 'function' ||
        typeof navigator.clipboard?.write !== 'function'
    ) {
        throw new Error(
            'Copying an image requires a secure connection and a browser that supports image clipboard access.'
        );
    }

    return (image) => {
        try {
            const item = new ClipboardItem({ 'image/png': image });
            return navigator.clipboard.write([item]).catch((error: unknown) => {
                throw clipboardWriteError(error);
            });
        } catch (error) {
            throw clipboardWriteError(error);
        }
    };
}
