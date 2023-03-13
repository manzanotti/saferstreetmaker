import LZString from 'lz-string';
import { EventTopics } from './EventTopics';
import { IMapLayer } from './layers/IMapLayer';
import { Settings } from '../Settings';

export class FileManager {
    saveMapToFile = (settings: Settings, layersData: Map<string, IMapLayer>) => {
        const mapData = this.mapToJSON(settings, layersData);
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

    saveMapToHash = (settings: Settings, layersData: Map<string, IMapLayer>): string => {
        const mapData = this.mapToJSON(settings, layersData);
        const mapString = JSON.stringify(mapData);
        const uriEncodedString = LZString.compressToEncodedURIComponent(mapString);

        return uriEncodedString;
    }

    saveMap = (settings: Settings, layersData: Map<string, IMapLayer>) => {
        const mapData = this.mapToJSON(settings, layersData);
        const mapString = JSON.stringify(mapData);

        localStorage.setItem(`Map_${settings.title}`, LZString.compress(mapString));
        this.saveMapList(settings.title);

        this.saveLastMapSelected(settings.title);
    };

    saveMapList = (mapTitle: string) => {
        let mapList = this.loadMapListFromStorage();

        if (mapList.includes(mapTitle)) {
            mapList = mapList.filter((title) => title !== mapTitle);
        }

        mapList.splice(0, 0, mapTitle);
        localStorage.setItem('MapList', LZString.compress(JSON.stringify(mapList)));
    }

    private mapToJSON = (settings: Settings, layersData: Map<string, IMapLayer>): any => {
        let layers = {};
        layersData.forEach((layer, layerName) => {
            layers[layerName] = layer.toGeoJSON();
        });

        const mapData = {
            'settings': settings,
            'layers': layers,
            'lastSaved': new Date().toISOString()
        };

        return mapData;
    }

    saveLastMapSelected = (mapName: string) => {
        localStorage.setItem('LastMapSelected', LZString.compress(mapName));
    };

    copyMap = (settings: Settings, layersData: Map<string, IMapLayer>) => {
        let newIndex = 1;
        const mapList = this.loadMapListFromStorage();
        while (mapList.includes(`Map_${settings.title}_copy_${newIndex}`)) {
            newIndex++;
        }
        settings.title = `${settings.title}_copy_${newIndex}`;
        this.saveMap(settings, layersData);
    }

    loadMapFromHash = (hash: string) => {
        let mapString: string | null = null;

        if (hash.startsWith('%')) {
            mapString = decodeURIComponent(hash);
            return JSON.parse(mapString);
        } else {
            mapString = LZString.decompressFromEncodedURIComponent(hash);
            if (mapString === null) {
                return null;
            }

            return JSON.parse(mapString);
        }
    }

    loadMapFromFile = () => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.style.display = 'none';
        fileInput.accept = '.json';
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
            if (e.target === null) {
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

    loadMapListFromStorage = (): Array<string> => {
        const mapListData = localStorage.getItem('MapList');
        if (mapListData !== null && mapListData !== 'undefined') {
            const mapList = LZString.decompress(mapListData) || '';
            return JSON.parse(mapList);
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

    deleteMapFromStorage = (mapName: string) => {
        localStorage.removeItem(`Map_${mapName}`);

        const mapData = localStorage.getItem('MapList');
        if (mapData !== null && mapData !== 'undefined') {
            const data = LZString.decompress(mapData) || '';
            const mapList = JSON.parse(data);

            const index = mapList.indexOf(mapName);
            if (index !== -1) {
                mapList.splice(index, 1);
                localStorage.setItem('MapList', LZString.compress(JSON.stringify(mapList)));
            }
        }
        return [];
    }
}
