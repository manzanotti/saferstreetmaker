import type { IMapLayer } from '../../composables/layers/IMapLayer';
import type { Group } from '../../models/Group';
import type { Settings } from '../../models/Settings';
import type { FileManager } from '../../services/FileManager';
import type { SerializedMap } from '../../services/MapSerializer';
import type { ImportedGeoJsonLayer } from '../../models/ImportedGeoJsonLayer';

export interface MapSnapshotBuilderOptions {
    fileManager: Pick<FileManager, 'buildSerializedMap'>;
    getSettings: () => Settings;
    getLayers: () => Map<string, IMapLayer>;
    getGroups: () => Group[];
    getImportedLayers?: () => ImportedGeoJsonLayer[];
}

export class MapSnapshotBuilder {
    private readonly options: MapSnapshotBuilderOptions;

    constructor(options: MapSnapshotBuilderOptions) {
        this.options = options;
    }

    build(): SerializedMap {
        return this.options.fileManager.buildSerializedMap(
            this.options.getSettings(),
            this.options.getLayers(),
            this.options.getGroups(),
            this.options.getImportedLayers?.() ?? []
        );
    }
}
