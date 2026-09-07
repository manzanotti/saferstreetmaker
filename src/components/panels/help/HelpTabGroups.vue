<template>
    <h2>
        <img
            src="../../../img/group.svg"
            class="inline-block w-10 h-10 object-contain align-middle"
            alt=""
            aria-hidden="true"
        />
        Groups
    </h2>
    <p class="mb-8">
        Groups let you collect related map features together. They are useful for showing a complete
        proposal, such as a set of modal filters and mobility lanes, selecting related features
        together, and keeping alternative designs organised.
    </p>
    <h2>Creating and opening groups</h2>
    <p class="mb-8">
        To create a group, use the Area Selection tool to select one or more features, then choose
        <strong>Add selected features to a group</strong>. Give the group a name when prompted. You
        can open the Groups panel with the Groups button in the command toolbar, or press
        <strong>G</strong> when the map has focus.
    </p>
    <h2>Using groups</h2>
    <p class="mb-8">
        Click a group name to select and highlight all of its active features and fit the map to
        them. Use the eye button to hide or show a group. The plus button lets you select additional
        features and add them to the group. You can rename a group, remove its members without
        deleting the map features, or delete the group and its features. Group changes can be
        restored with Undo.
    </p>
    <h2>Group colours</h2>
    <p class="mb-8">
        Use the colour swatch beside a group to apply that colour to all LTN cells in the group,
        including both their fill and outline. If an LTN cell belongs to multiple groups with
        different colours, its fill and outline use a striped pattern showing all of those colours.
    </p>
    <h2>Group versions</h2>
    <p class="mb-8">
        A group can contain several independent versions of a design. The first version is the
        default. Select <strong>+ Version</strong> to create a copy of the current version; its
        features are cloned so edits to the new version do not alter the original. Give each version
        a unique name.
    </p>
    <p class="mb-8">
        Use the version dropdown to switch designs. Only the selected version is shown on the map,
        and its features are highlighted when the group is selected. Use
        <strong>Set default</strong> to choose which version is shown when the map is loaded. The
        current default is marked <strong>Default</strong>. Deleting a version removes its copied
        features; Undo can restore the deletion if needed.
    </p>
    <h2>Group phases</h2>
    <p class="mb-8">
        Phases let you divide a version's features into an ordered sequence of works or changes.
        Click <strong>Phases</strong> beside a version to view its phases. Each phase contains
        features from that version, so changing the version does not change the phase plan for
        another version.
    </p>
    <p class="mb-8">
        Click <strong>New phase</strong> to create a phase, or click an existing phase to edit it.
        Select the features for that phase on the map; features already assigned to another phase
        are removed from that phase when they are added here. Empty phases can be deleted when you
        finish editing.
    </p>
    <p class="mb-8">
        Reorder phases by dragging them in the list. When a phase is focused, you can also use the
        Up and Down arrow keys to move it. Close the phases window when you are finished; phase
        changes are saved with the group and can be restored with Undo.
    </p>
</template>
