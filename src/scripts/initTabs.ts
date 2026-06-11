// Lightweight tab controller for the help modal's pill navigation.
// It toggles the `data-tab-nav-active` attribute on the nav links and
// `data-tab-active` on the matching panels, which the existing Tailwind
// `data-[...]` variant classes use for styling.
export const initTabs = (): void => {
    const tabLinks = Array.from(
        document.querySelectorAll<HTMLAnchorElement>('[data-tab-toggle]')
    );

    if (tabLinks.length === 0) {
        return;
    }

    const activate = (link: HTMLAnchorElement): void => {
        const targetSelector = link.getAttribute('data-tab-target');
        if (!targetSelector) {
            return;
        }

        tabLinks.forEach((other) => {
            other.removeAttribute('data-tab-nav-active');
            other.setAttribute('aria-selected', 'false');

            const panelSelector = other.getAttribute('data-tab-target');
            if (panelSelector) {
                document
                    .querySelector(panelSelector)
                    ?.removeAttribute('data-tab-active');
            }
        });

        link.setAttribute('data-tab-nav-active', '');
        link.setAttribute('aria-selected', 'true');
        document.querySelector(targetSelector)?.setAttribute('data-tab-active', '');
    };

    tabLinks.forEach((link) => {
        link.addEventListener('click', (event) => {
            event.preventDefault();
            activate(link);
        });
    });
};
