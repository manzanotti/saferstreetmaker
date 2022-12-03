import LZString from 'lz-string';
import { EventTopics } from './EventTopics';
import { IMapLayer } from './layers/IMapLayer';
import { Settings } from '../Settings';

export class FileManager {
    saveMapToFile = (settings: Settings, layersData: Map<string, IMapLayer>, centre: L.LatLng, zoom: number) => {
        const mapData = this.mapToJSON(settings, layersData, centre, zoom);
        const mapString = JSON.stringify(mapData);

        const blob = new Blob([mapString], { type: 'text/plain;charset=utf-8' });
        const hyperlink = document.createElement("a");
        hyperlink.href = URL.createObjectURL(blob);
        hyperlink.download = `${settings.title}.json`;
        hyperlink.click();
    };

    saveMapToGeoJSONFile = (settings: Settings, layersData: Map<string, IMapLayer>) => {
        let layers = new Array<any>;
        layersData.forEach((layer, layerName) => {
            layers.push(layer.toGeoJSON());
        });

        const geoJSON = layers[0];

        layers.slice(1).forEach((layer) => {
            const features = layer.features;
            geoJSON.features.push(...features);
        });

        const mapString = JSON.stringify(geoJSON);

        const blob = new Blob([mapString], { type: 'text/plain;charset=utf-8' });
        const hyperlink = document.createElement("a");
        hyperlink.href = URL.createObjectURL(blob);
        hyperlink.download = `${settings.title}.json`;
        hyperlink.click();
    };

    saveMapToHash = (settings: Settings, layersData: Map<string, IMapLayer>, centre: L.LatLng, zoom: number): string => {
        const mapData = this.mapToJSON(settings, layersData, centre, zoom);
        const mapString = JSON.stringify(mapData);
        const uriEncodedString = encodeURIComponent(mapString);

        return uriEncodedString;
    }

    saveMap = (settings: Settings, layersData: Map<string, IMapLayer>, centre: L.LatLng, zoom: number) => {
        const mapData = this.mapToJSON(settings, layersData, centre, zoom);
        const mapString = JSON.stringify(mapData);

        localStorage.setItem(`Map_${settings.title}`, LZString.compress(mapString));
    };

    private mapToJSON = (settings: Settings, layersData: Map<string, IMapLayer>, centre: L.LatLng, zoom: number): any => {
        let layers = {};
        layersData.forEach((layer, layerName) => {
            layers[layerName] = layer.getLayer().toGeoJSON();
        });

        const mapData = {
            'settings': settings,
            'centre': centre,
            'zoom': zoom,
            'layers': layers
        };

        return mapData;
    }

    saveLastMapSelected = (mapName: string) => {
        localStorage.setItem('LastMapSelected', LZString.compress(mapName));
    };

    loadMapFromHash = (hash: string) => {
        const map = decodeURIComponent(hash);
        return JSON.parse(map);
    }

    loadMapFromFile = () => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.style.display = 'none';
        fileInput.onchange = this.readFile;
        document.body.appendChild(fileInput);

        fileInput.click();
    };

    loadMapFromRemoteFile = async (url) => {
        var response = await fetch(url);

        return response.json();
    }

    private readFile = (e) => {
        let fileInput = e.target;
        const file = fileInput.files[0];
        if (!file) {
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            if(e.target === null){
                return;
            }

            const contents = e.target.result || '';
            const map = JSON.parse(<string>contents);
            PubSub.publish(EventTopics.fileLoaded, map);
            document.body.removeChild(fileInput);
        }
        reader.readAsText(file, 'text/plain;charset=utf-8');
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

    loadMapFromStorage = (mapName: string) => {
        const mapData = localStorage.getItem(`Map_${mapName}`);
        if (mapData !== null && mapData !== 'undefined') {
            const map = LZString.decompress(mapData) || '';
            return JSON.parse(map);
        }
        return null;
    };
}
