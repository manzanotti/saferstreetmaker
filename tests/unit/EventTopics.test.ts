import { describe, it, expect } from 'vitest';
import { EventTopics } from '../../src/scripts/EventTopics';

describe('EventTopics', () => {
    it('has unique values for all topics', () => {
        const values = Object.values(EventTopics).filter(v => typeof v === 'string');
        const unique = new Set(values);
        expect(unique.size).toBe(values.length);
    });

    it('defines all expected static topic strings', () => {
        expect(EventTopics.closePopup).toBe('closePopup');
        expect(EventTopics.layerDeselected).toBe('layerDeselected');
        expect(EventTopics.drawCreated).toBe('drawCreated');
        expect(EventTopics.fileLoaded).toBe('fileLoaded');
        expect(EventTopics.hideSettings).toBe('hideSettings');
        expect(EventTopics.layerSelected).toBe('layerSelected');
        expect(EventTopics.layerUpdated).toBe('layerUpdated');
        expect(EventTopics.loadMapFromFile).toBe('loadMapFromFile');
        expect(EventTopics.mapClicked).toBe('mapClicked');
        expect(EventTopics.showPopup).toBe('showPopup');
        expect(EventTopics.saveMapToFile).toBe('saveMapToFile');
        expect(EventTopics.saveMapToGeoJSONFile).toBe('saveMapToGeoJSONFile');
        expect(EventTopics.saveSettings).toBe('saveSettings');
        expect(EventTopics.showHelp).toBe('showHelp');
        expect(EventTopics.hideHelp).toBe('hideHelp');
        expect(EventTopics.showSettings).toBe('showSettings');
        expect(EventTopics.showSharingPopup).toBe('showSharingPopup');
        expect(EventTopics.mapZoomChanged).toBe('mapZoomChanged');
        expect(EventTopics.hideLayer).toBe('hideLayer');
        expect(EventTopics.showLayer).toBe('showLayer');
        expect(EventTopics.hideModalWindows).toBe('hideOtherModalWindows');
        expect(EventTopics.showMapManager).toBe('showMapManager');
        expect(EventTopics.createNewMap).toBe('createNewMap');
    });

    it('all topic values are non-empty strings', () => {
        const keys = Object.getOwnPropertyNames(EventTopics).filter(
            k => typeof (EventTopics as any)[k] === 'string'
        );
        for (const key of keys) {
            expect((EventTopics as any)[key]).toBeTruthy();
        }
    });
});
