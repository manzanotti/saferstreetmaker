import LZString from 'lz-string';

export class MapManager {
    fileLoadedTopic: string = 'fileLoaded';

    saveMapToFile = (mapName, layersData, centre, zoom) => {
        const mapData = this.mapToJSON(mapName, layersData, centre, zoom);

        const blob = new Blob([mapData], { type: 'text/plain;charset=utf-8' });
        const hyperlink = document.createElement("a");
        hyperlink.href = URL.createObjectURL(blob);
        hyperlink.download = `${mapName}.json`;
        hyperlink.click();
    };

    saveMap = (mapName, layersData, centre, zoom) => {
        const mapData = this.mapToJSON(mapName, layersData, centre, zoom);

        localStorage.setItem(`Map_${mapName}`, LZString.compress(mapData));
    };

    private mapToJSON = (mapName, layersData, centre, zoom): string => {
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

        return JSON.stringify(mapData);
    }

    saveLastMapSelected = (mapName) => {
        localStorage.setItem('LastMapSelected', LZString.compress(mapName));
    };

    loadMapFromFile = () => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.style.display = 'none';
        fileInput.onchange = this.readFile;
        document.body.appendChild(fileInput);

        fileInput.click();
    };

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
            PubSub.publish(this.fileLoadedTopic, map);
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

    loadMapFromStorage = (mapName) => {
        const mapData = localStorage.getItem(`Map_${mapName}`);
        if (mapData !== null && mapData !== 'undefined') {
            const map = LZString.decompress(mapData) || '';
            return JSON.parse(map);
        }
        return null;
    };
}
