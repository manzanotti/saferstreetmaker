import { Settings } from '../../models/Settings';
import type { SerializedMap } from '../../services/MapSerializer';

export interface SettingsApplierOptions {
    getCurrentTitle: () => string;
    getCurrentSettings: () => Settings;
    buildSnapshot: () => SerializedMap;
    getActiveHistoryTitle: () => string | null;
    setLastSavedSnapshot: (snapshot: SerializedMap) => void;
    activateHistory: (title: string) => Promise<void>;
    setPendingHistoryMutation: (mutation: {
        kind: string;
        layerId: string;
        payload?: unknown;
    }) => void;
    createMutationPayload: (before: Settings, after: Settings) => unknown;
    applySettings: (settings: Settings) => void;
    removeAllLayers: () => void;
    addLayers: (layerIds: string[]) => void;
    setVisibleLayerIds: (layerIds: Set<string>) => void;
    saveMapOrThrow: () => Promise<void>;
    renameHistory: (fromTitle: string, toTitle: string) => Promise<void>;
}

export class SettingsApplier {
    private readonly options: SettingsApplierOptions;

    constructor(options: SettingsApplierOptions) {
        this.options = options;
    }

    async apply(newSettings: Settings): Promise<void> {
        const previousTitle = this.options.getCurrentTitle();
        const previousSettings = this.options.getCurrentSettings();
        const beforeSnapshot = this.options.buildSnapshot();

        this.options.setLastSavedSnapshot(beforeSnapshot);
        if (this.options.getActiveHistoryTitle() === null) {
            await this.options.activateHistory(previousTitle);
        }

        this.options.setPendingHistoryMutation({
            kind: 'settings-apply',
            layerId: 'settings',
            payload: this.options.createMutationPayload(previousSettings, newSettings)
        });

        this.options.applySettings(newSettings);
        this.options.removeAllLayers();
        this.options.addLayers(newSettings.activeLayers);
        this.options.setVisibleLayerIds(new Set(newSettings.activeLayers));

        await this.options.saveMapOrThrow();

        if (previousTitle !== newSettings.title) {
            await this.options.renameHistory(previousTitle, newSettings.title);
        }

        await this.options.activateHistory(newSettings.title);
    }
}
