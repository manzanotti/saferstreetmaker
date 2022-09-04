import { MapManager } from './MapManager';
import { MapContainer } from './MapContainer';

document.addEventListener('DOMContentLoaded', () => {
    const mapManager = new MapManager();
    const mapContainer = new MapContainer(mapManager);
    if (!mapContainer.loadMap()) {
        if (window.navigator.geolocation) {
            window.navigator.geolocation
                .getCurrentPosition(mapContainer.setUserLocation, console.log);
        }
    }
});
