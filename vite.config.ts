import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { viteExternalsPlugin } from 'vite-plugin-externals';

export default defineConfig({
    root: 'src',
    publicDir: 'public',
    plugins: [
        vue(),
        tailwindcss(),
        // Keep heavy libraries on the CDN (loaded via <script> tags in index.html)
        // by mapping their bare imports to the global variables they expose.
        viteExternalsPlugin({
            leaflet: 'L',
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
