<script setup lang="ts">
defineProps<{
    activeTab: string;
    tabPanelClass: string;
}>();
</script>

<template>
    <div
        id="tabs-layers"
        :class="tabPanelClass"
        :data-tab-active="activeTab === 'tabs-layers' ? '' : undefined"
        role="tabpanel"
        aria-labelledby="tabs-layers-tab"
    >
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
            The Layers panel lets you add GeoJSON data to your map as an imported layer. Open it
            with the overlapping squares button in the toolbar, or press <strong>L</strong> when the
            map has focus.
        </p>
        <h2>Adding a layer</h2>
        <p class="mb-8">
            Select <strong>Add layer</strong>, then upload a GeoJSON or JSON file, or enter a URL to
            load GeoJSON from the web. Give the layer a name and, if available, choose a property to
            use as each feature's name before selecting <strong>Add layer</strong>.
        </p>
        <p class="mb-8">
            Birmingham Council wards are pre-loaded as an example of the kind of GeoJSON data you
            can import. They are hidden initially; use the eye button in the Layers panel to show
            them.
        </p>
        <h2>Showing and editing layers</h2>
        <p class="mb-8">
            Use the eye button beside an imported layer to show or hide it. Select the layer name to
            open its items panel, where you can rename the layer and search its named items. Items
            without a name are not listed, and items with the same name have separate rows.
            Searching only filters the list; it does not hide anything on the map. Select an item's
            name to centre it in the map view without changing the zoom or its visibility. Items
            without a location cannot be centred.
        </p>
        <p class="mb-8">
            Each item's eye button cycles from visible to hidden, then to showing only that item.
            While one item is shown alone, any item's eye button shows all items in that layer
            again. Only this layer is affected; other layers and planning features stay unchanged.
            Use <strong>Hide all items</strong> or <strong>Show all items</strong> to change the
            whole layer at once. A hidden layer must be shown before its items appear.
        </p>
        <p class="mb-8">
            Item visibility is temporary: it is kept when you close the panel, but resets when you
            reload or load a map. These choices are not saved in shared links. The layer's features
            appear below the map's planning features, so they do not prevent you from adding or
            editing other features. When a feature name property was selected, click its feature to
            edit the name in the popup.
        </p>
        <h2>Presentation mode</h2>
        <p class="mb-8">
            In Presentation mode, imported layers can still be shown or hidden, but they cannot be
            renamed or deleted, and feature names cannot be edited.
        </p>
    </div>
</template>
