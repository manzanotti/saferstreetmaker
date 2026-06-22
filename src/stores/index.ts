import { createPinia } from 'pinia';

/**
 * Single shared Pinia instance. Exported so every Vue mini-app
 * (including controls mounted into Leaflet control containers) can
 * call  createApp(Component).use(pinia)  to share the same state.
 */
export const pinia = createPinia();
