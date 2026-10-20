<script setup lang="ts">
defineProps<{
    activeTab: string;
    tabPanelClass: string;
}>();
</script>

<template>
    <div
        id="tabs-shortcuts"
        :class="tabPanelClass"
        :data-tab-active="activeTab === 'tabs-shortcuts' ? '' : undefined"
        role="tabpanel"
        aria-labelledby="tabs-shortcuts-tab"
    >
        <h2>Keyboard shortcuts</h2>
        <p class="mb-4">
            Use Ctrl on Windows or Linux, or Command on macOS, for the shortcuts below. Editing
            shortcuts do not run while typing in a text field or in Presentation mode.
        </p>
        <h3 class="font-semibold mb-2">Map tools</h3>
        <p class="mb-4">
            Focus the map before using these shortcuts, rather than a toolbar button or input.
        </p>
        <ul class="list-disc pl-5 mb-6 space-y-2">
            <li><strong>P</strong>: toggle Presentation mode on or off, with panels closed.</li>
            <li><strong>S</strong>: toggle area selection.</li>
            <li><strong>G</strong>: open or close the Groups panel.</li>
            <li>
                <strong>L</strong>: open or close the Layers panel, including in Presentation mode.
            </li>
            <li>
                <strong>Delete / Backspace</strong>: delete selected features (not a group
                membership selection). Grouped features may prompt you to choose the deletion scope.
            </li>
        </ul>
        <h3 class="font-semibold mb-2">History and clipboard</h3>
        <ul class="list-disc pl-5 mb-6 space-y-2">
            <li><strong>Ctrl/Command + Z</strong>: undo.</li>
            <li>
                <strong>Ctrl/Command + Y</strong> or <strong>Ctrl/Command + Shift + Z</strong>:
                redo.
            </li>
            <li>
                <strong>Ctrl/Command + C</strong>: copy selected features while area selection is
                active. Selected text keeps the normal browser copy behaviour.
            </li>
            <li>
                <strong>Ctrl/Command + V</strong>: paste copied features while area selection is
                active.
            </li>
        </ul>
        <h3 class="font-semibold mb-2">Map navigation and selection</h3>
        <ul class="list-disc pl-5 mb-6 space-y-2">
            <li><strong>Arrow keys</strong>: pan the focused map.</li>
            <li><strong>+ / -</strong>: zoom the focused map in or out.</li>
            <li><strong>Shift + arrow key or + / -</strong>: pan or zoom three times as far.</li>
            <li>
                <strong>Shift + drag</strong>: zoom to a rectangle when area selection is inactive.
            </li>
            <li>
                <strong>Shift, Ctrl, or Command + click</strong>: add a feature to the selection.
                Hold one of these keys while dragging an area selection to extend it.
            </li>
        </ul>
        <h3 class="font-semibold mb-2">Panels, editors, and focused controls</h3>
        <ul class="list-disc pl-5 mb-6 space-y-2">
            <li>
                <strong>Escape</strong>: close the current panel, dialog, popup, or toolbar submenu;
                cancel drawing; leave feature, group, or phase editing; or clear a highlighted
                selection. The active panel or editing context takes priority.
            </li>
            <li>
                <strong>Enter</strong>: confirm a group or version name, load a GeoJSON URL, or save
                a feature name. Feature names also save when the input loses focus. In an LTN label
                field, Enter saves and closes the editor.
            </li>
            <li>
                <strong>Escape in a group description</strong>: cancel description edits without
                saving.
            </li>
            <li><strong>Arrow Down on a grouped toolbar button</strong>: open its tool submenu.</li>
            <li><strong>Arrow Up / Arrow Down on a phase row</strong>: reorder that phase.</li>
            <li>
                <strong>Enter / Space</strong>: activate a focused button, load a focused saved map,
                or toggle a focused legend heading or layer.
            </li>
            <li>
                <strong>Tab / Shift + Tab</strong>: move focus forwards or backwards through
                controls.
            </li>
        </ul>
    </div>
</template>
