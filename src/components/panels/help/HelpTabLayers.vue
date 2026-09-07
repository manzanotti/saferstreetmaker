<template>
    <h2>
        <img
            src="../../../img/layers-overlap.svg"
            class="inline-block w-10 h-10 object-contain align-middle"
            alt=""
            aria-hidden="true"
        />
        Layers
    </h2>
    <p class="mb-8">
        The Layers panel lets you add GeoJSON data to your map as an imported layer. Open it with
        the overlapping squares button in the toolbar, or press <strong>L</strong> when the map has
        focus.
    </p>
    <h2>Adding a layer</h2>
    <p class="mb-8">
        Select <strong>Add layer</strong>, then upload a GeoJSON or JSON file, or enter a URL to
        load GeoJSON from the web. Give the layer a name and, if available, choose a property to use
        as each feature's name before selecting <strong>Add layer</strong>.
    </p>
    <p class="mb-8">
        Birmingham Council wards are pre-loaded as an example of the kind of GeoJSON data you can
        import. They are hidden initially; use the eye button in the Layers panel to show them.
    </p>
    <h2>Showing and editing layers</h2>
    <p class="mb-8">
        Use the eye button beside an imported layer to show or hide it. The layer's features appear
        below the map's planning features, so they do not prevent you from adding or editing other
        features. When a feature name property was selected, click its feature to edit the name in
        the popup.
    </p>
    <h2>Read-only maps</h2>
    <p class="mb-8">
        On a read-only map, imported layers can still be shown or hidden, but they cannot be renamed
        or deleted, and feature names cannot be edited.
    </p>
</template>
