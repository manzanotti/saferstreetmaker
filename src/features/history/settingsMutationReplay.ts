export interface HistorySettingsSnapshot {
    title: string;
    readOnly: boolean;
    hideToolbar: boolean;
    activeLayers: string[];
    version: string;
}

export interface SettingsMutationPayload {
    before?: HistorySettingsSnapshot;
    after?: HistorySettingsSnapshot;
}

interface SettingsLike {
    title: string;
    readOnly: boolean;
    hideToolbar: boolean;
    activeLayers: string[];
    centre: { lat: number; lng: number } | null;
    zoom: number;
    version: string;
}

export function createSettingsMutationPayload(
    before: SettingsLike,
    after: SettingsLike
): SettingsMutationPayload {
    return {
        before: toHistorySettingsSnapshot(before),
        after: toHistorySettingsSnapshot(after)
    };
}

export function getSettingsMutationTarget(
    payload: unknown,
    direction: 'undo' | 'redo'
): HistorySettingsSnapshot | null {
    if (!isSettingsMutationPayload(payload)) {
        return null;
    }

    return direction === 'undo' ? (payload.before ?? null) : (payload.after ?? null);
}

function isSettingsMutationPayload(value: unknown): value is SettingsMutationPayload {
    if (!isRecord(value)) {
        return false;
    }

    return (
        (value.before === undefined || isHistorySettingsSnapshot(value.before)) &&
        (value.after === undefined || isHistorySettingsSnapshot(value.after))
    );
}

function isHistorySettingsSnapshot(value: unknown): value is HistorySettingsSnapshot {
    if (!isRecord(value)) {
        return false;
    }

    return (
        typeof value.title === 'string' &&
        typeof value.readOnly === 'boolean' &&
        typeof value.hideToolbar === 'boolean' &&
        Array.isArray(value.activeLayers) &&
        value.activeLayers.every((layerId) => typeof layerId === 'string') &&
        typeof value.version === 'string'
    );
}

function toHistorySettingsSnapshot(settings: SettingsLike): HistorySettingsSnapshot {
    return {
        title: settings.title,
        readOnly: settings.readOnly,
        hideToolbar: settings.hideToolbar,
        activeLayers: [...settings.activeLayers],
        version: settings.version
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
