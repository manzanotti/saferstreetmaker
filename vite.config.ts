import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { viteExternalsPlugin } from 'vite-plugin-externals';

export default defineConfig({
    root: 'src',
    publicDir: 'public',
    plugins: [
        tailwindcss(),
        // Keep heavy libraries on the CDN (loaded via <script> tags in index.html)
        // by mapping their bare imports to the global variables they expose.
        viteExternalsPlugin({
            leaflet: 'L',
            'pubsub-js': 'PubSub',
            'lz-string': 'LZString',
        }),
    ],
    build: {
        outDir: '../dist',
        emptyOutDir: true,
    },
    server: {
        port: 1234,
        strictPort: true,
    },
    preview: {
        port: 1234,
        strictPort: true,
    },
});
