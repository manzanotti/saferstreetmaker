import { FileManager } from './FileManager';
import { MapContainer } from './MapContainer';

document.addEventListener('DOMContentLoaded', async () => {
    const fileManager = new FileManager();
    const mapContainer = new MapContainer(fileManager);

    const params = new URLSearchParams(window.location.search);

    const remoteMapFile = params.get('map');

    const mapLoaded = await mapContainer.loadMap(remoteMapFile);

    if (!mapLoaded && window.navigator.geolocation) {
        window.navigator.geolocation
            .getCurrentPosition(mapContainer.setUserLocation, mapContainer.setDefaultView);
    }
});
