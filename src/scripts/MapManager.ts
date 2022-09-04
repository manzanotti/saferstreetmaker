import LZString from 'lz-string';

export class MapManager {
    saveMap = (mapName, layersData, centre, zoom) => {
        let layers = {};
        layersData.forEach((layer, layerName) => {
            layers[layerName] = layer.getLayer().toGeoJSON();
        });

        const mapData = {
            'title': mapName,
            'centre': centre,
            'zoom': zoom,
            'layers': layers
        };

        const data = JSON.stringify(mapData);
        localStorage.setItem(`Map_${mapName}`, LZString.compress(data));
    };

    saveLastMapSelected = (mapName) => {
        localStorage.setItem('LastMapSelected', LZString.compress(mapName));
    };

    loadLastMapSelected = () => {
        const mapData = localStorage.getItem('LastMapSelected');

        if (mapData !== null && mapData !== 'undefined') {
            const mapName = LZString.decompress(mapData) || '';
            return mapName;
        }
        return '';

    };

    loadMapListFromStorage = () => {
        const mapData = localStorage.getItem('MapList');
        if (mapData !== null && mapData !== 'undefined') {
            const map = LZString.decompress(mapData) || '';
            return JSON.parse(map);
        }
        return [];
    };

    loadMapFromStorage = (mapName) => {
        const mapData = localStorage.getItem(`Map_${mapName}`);
        if (mapData !== null && mapData !== 'undefined') {
            const map = LZString.decompress(mapData) || '';
            return JSON.parse(map);
        }
        return null;
    };
}
