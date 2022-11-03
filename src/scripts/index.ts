import { MapManager } from './MapManager';
import { MapContainer } from './MapContainer';

document.addEventListener('DOMContentLoaded', async () => {
    const mapManager = new MapManager();
    const mapContainer = new MapContainer(mapManager);

    const params = new URLSearchParams(window.location.search);

    const remoteMapFile = params.get('map');

    const mapLoaded = await mapContainer.loadMap(remoteMapFile);

    if (!mapLoaded && window.navigator.geolocation) {
        window.navigator.geolocation
            .getCurrentPosition(mapContainer.setUserLocation, console.log);
    }
});
