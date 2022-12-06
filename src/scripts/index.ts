import { FileManager } from './FileManager';
import { MapContainer } from './MapContainer';

document.addEventListener('DOMContentLoaded', async () => {
    const fileManager = new FileManager();
    const mapContainer = new MapContainer(fileManager);

    const params = new URLSearchParams(window.location.search);

    const remoteMapFile = params.get('map');
    const hash = window.location.hash;
    const hideToolbar = params.get('hide-toolbar') === 'true';

    const mapLoaded = await mapContainer.loadMap(remoteMapFile, hash, hideToolbar);

    if (!mapLoaded && window.navigator.geolocation) {
        window.navigator.geolocation
            .getCurrentPosition(mapContainer.setUserLocation, mapContainer.setDefaultView);
    }
});
