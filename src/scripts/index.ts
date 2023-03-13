import { FileManager } from './FileManager';
import { MapContainer } from './MapContainer';

document.addEventListener('DOMContentLoaded', async () => {
    const fileManager = new FileManager();
    const mapContainer = new MapContainer(fileManager);

    const params = new URLSearchParams(window.location.search);

    const remoteMapFile = params.get('map');
    const hash = window.location.hash;
    const hideToolbar = params.get('hide-toolbar') === 'true';
    const zoom = params.get('zoom');
    const centreString = params.get('centre');

    let centre: Array<number> | null = null;
    if (centreString) {
        const centreStrings = centreString.split(',');
        if (centreStrings !== null && centreStrings.length === 2) {
            const lat = Number(centreStrings[0]);
            const long = Number(centreStrings[1]);

            if (!isNaN(lat) && !isNaN(long)) {
                centre = new Array<number>();
                centre.push(lat);
                centre.push(long);
            }
        }
    }

    const mapLoaded = await mapContainer.loadMap(remoteMapFile, hash, hideToolbar, zoom, centre);

    if (!mapLoaded && window.navigator.geolocation) {
        window.navigator.geolocation
            .getCurrentPosition(mapContainer.setUserLocation, mapContainer.setDefaultView);
    }
});
