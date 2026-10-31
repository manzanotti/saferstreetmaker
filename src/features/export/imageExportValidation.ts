export const MIN_IMAGE_EXPORT_DIMENSION = 256;
export const MAX_IMAGE_EXPORT_DIMENSION = 8192;
export const MAX_IMAGE_EXPORT_PIXELS = 16_777_216;

export function getImageExportValidationError(
    width: number | null,
    height: number | null
): string | null {
    if (width === null || height === null || !Number.isFinite(width) || !Number.isFinite(height)) {
        return 'Enter a width and height in pixels.';
    }
    if (!Number.isInteger(width) || !Number.isInteger(height)) {
        return 'Width and height must be whole numbers.';
    }
    if (
        width < MIN_IMAGE_EXPORT_DIMENSION ||
        height < MIN_IMAGE_EXPORT_DIMENSION ||
        width > MAX_IMAGE_EXPORT_DIMENSION ||
        height > MAX_IMAGE_EXPORT_DIMENSION
    ) {
        return `Choose dimensions between ${MIN_IMAGE_EXPORT_DIMENSION} and ${MAX_IMAGE_EXPORT_DIMENSION} pixels.`;
    }
    if (width * height > MAX_IMAGE_EXPORT_PIXELS) {
        return 'The image is too large. Reduce its width or height.';
    }
    return null;
}

export function buildImageExportFilename(title: string): string {
    const safeTitle = title
        .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
        .replace(/[. ]+$/g, '')
        .trim();
    return `${safeTitle || 'map'}.png`;
}
