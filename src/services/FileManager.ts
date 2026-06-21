/**
 * FileManager
 *
 * Orchestrates all map persistence and I/O for the application.
 * Responsibilities are delegated to specialist classes:
 *
 *   MapSerializer — pure data transforms (JSON ↔ LZ-string hash)
 *   MapStorage    — localStorage CRUD
 *   FileManager   — OS file I/O (upload / download / remote fetch) + callback wiring
 */
import type { IMapLayer } from '../composables/layers/IMapLayer';
import type { Settings } from '../models/Settings';
import { MapSerializer, type SerializedMap } from './MapSerializer';
import { MapStorage } from './MapStorage';

export class FileManager {
    readonly serializer: MapSerializer;
    readonly storage: MapStorage;

    private _onFileLoaded: ((data: unknown) => void) | null = null;

    constructor() {
        this.serializer = new MapSerializer();
        this.storage = new MapStorage(this.serializer);
    }

    // ── File-loaded callback ──────────────────────────────────────────────────

    /**
     * Register a callback that fires when a file is loaded via the OS file picker.
     * Replaces the PubSub-based fileLoaded event used in Phase 2.
     */
    setOnFileLoaded(callback: (data: unknown) => void): void {
        this._onFileLoaded = callback;
    }

    // ── Serialisation (delegate to MapSerializer) ─────────────────────────────

    saveMapToHash(settings: Settings, layersData: Map<string, IMapLayer>): string {
        return this.serializer.toEncodedHash(settings, layersData);
    }

    loadMapFromHash(hash: string): SerializedMap | null {
        return this.serializer.fromEncodedHash(hash);
    }

    // ── Storage (delegate to MapStorage) ─────────────────────────────────────

    saveMap(settings: Settings, layersData: Map<string, IMapLayer>): void {
        this.storage.saveMap(settings, layersData);
    }

    loadMapFromStorage(mapName: string): SerializedMap | null {
        return this.storage.loadMap(mapName) as SerializedMap | null;
    }

    deleteMapFromStorage(mapName: string): void {
        this.storage.deleteMap(mapName);
    }

    copyMap(settings: Settings, layersData: Map<string, IMapLayer>): void {
        this.storage.copyMap(settings, layersData);
    }

    loadMapListFromStorage(): string[] {
        return this.storage.listMaps();
    }

    hasMapInStorage(mapName: string): boolean {
        return this.storage.hasMap(mapName);
    }

    saveLastMapSelected(mapName: string): void {
        this.storage.saveLastMapSelected(mapName);
    }

    loadLastMapSelected(): string {
        return this.storage.loadLastSelected();
    }

    /** Exposed for direct use in tests; saveMap() calls this automatically. */
    saveMapList(mapTitle: string): void {
        this.storage.saveMapList(mapTitle);
    }

    // ── File download ─────────────────────────────────────────────────────────

    saveMapToFile(settings: Settings, layersData: Map<string, IMapLayer>): void {
        const mapString = JSON.stringify(this.serializer.toJSON(settings, layersData));
        this._downloadBlob(mapString, `${settings.title}.json`);
    }

    saveMapToGeoJSONFile(settings: Settings, layersData: Map<string, IMapLayer>): void {
        const geoJSON: any = { type: 'FeatureCollection', features: [] };
        layersData.forEach((layer) => {
            const fc = layer.toGeoJSON() as any;
            if (fc?.features) {
                geoJSON.features.push(...fc.features);
            }
        });
        this._downloadBlob(JSON.stringify(geoJSON), `${settings.title}.json`);
    }

    private _downloadBlob(content: string, filename: string): void {
        const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
        const a = document.createElement('a');
        const url = URL.createObjectURL(blob);
        a.href = url;
        a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 0);
    }

    // ── File upload ───────────────────────────────────────────────────────────

    loadMapFromFile(): void {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.style.display = 'none';
        fileInput.accept = '.json';
        fileInput.onchange = this._readFile;
        document.body.appendChild(fileInput);
        fileInput.click();
    }

    private _readFile = (e: Event): void => {
        const fileInput = e.target as HTMLInputElement;
        const file = fileInput.files?.[0];
        if (!file) {
            this._removeFileInput(fileInput);
            return;
        }

        const reader = new FileReader();
        reader.onerror = () => {
            this._removeFileInput(fileInput);
        };
        reader.onload = (ev: ProgressEvent<FileReader>) => {
            try {
                if (ev.target === null) {
                    return;
                }
                const map = JSON.parse(ev.target.result as string);
                this._onFileLoaded?.(map);
            } finally {
                this._removeFileInput(fileInput);
            }
        };
        reader.readAsText(file, 'text/plain;charset=utf-8');
    };

    private _removeFileInput(fileInput: HTMLInputElement): void {
        if (document.body.contains(fileInput)) {
            document.body.removeChild(fileInput);
        }
    }

    // ── Remote fetch ──────────────────────────────────────────────────────────

    async loadMapFromRemoteFile(url: string): Promise<SerializedMap> {
        const r = await fetch(url);
        if (!r.ok) {
            throw new Error(`Failed to load remote map: ${r.status} ${r.statusText}`);
        }
        return await (r.json() as Promise<SerializedMap>);
    }
}
