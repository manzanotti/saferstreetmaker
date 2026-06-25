export const SAVE_ERROR_ALREADY_SHOWN = '__saveErrorAlreadyShown';

export function isSaveErrorAlreadyShown(error: unknown): boolean {
    return Boolean(
        (error as Record<string, unknown> | null | undefined)?.[SAVE_ERROR_ALREADY_SHOWN]
    );
}
