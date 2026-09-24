export interface LegendEntryOpts {
    layerId: string;
    title: string;
    toggleTitle: string;
    iconEl: HTMLElement;
    /** Object whose `visible` property is toggled on click. */
    visibilityState: { visible: boolean };
}

export function buildLegendEntry(opts: LegendEntryOpts): HTMLElement {
    const li = document.createElement('li');
    li.id = `${opts.layerId}-legend`;
    li.setAttribute('title', opts.toggleTitle);
    li.appendChild(opts.iconEl);

    const span = document.createElement('span');
    span.textContent = opts.title;
    li.appendChild(span);

    li.addEventListener('click', () => {
        opts.visibilityState.visible = !opts.visibilityState.visible;
        // Actual map visibility is handled by Legend.vue → mapStore.toggleLayerVisibility()
    });

    return li;
}
