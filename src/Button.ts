L.Control.Button = L.Control.extend(
    {
        options:
        {
            position: 'topleft',
            icon: '',
            command: null
        },
        onAdd: function (map) {
            var controlDiv = L.DomUtil.create('div', 'leaflet-draw-toolbar leaflet-bar');
            L.DomEvent
                .addListener(controlDiv, 'click', L.DomEvent.stopPropagation)
                .addListener(controlDiv, 'click', L.DomEvent.preventDefault)
                .addListener(controlDiv, 'click', function () {
                    drawnItems.clearLayers();
                });

            var controlUI = L.DomUtil.create('a', 'leaflet-draw-edit-remove', controlDiv);
            controlUI.title = 'Remove All Polygons';
            controlUI.href = '#';
            return controlDiv;
        }
    });

L.control.button = (icon, command) => {
    var args = Array.prototype.concat.apply([L.Control.Button], arguments);
    return new (Function.prototype.bind.apply(L.Control.Button, args));
}F