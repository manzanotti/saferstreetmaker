import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
    root: fileURLToPath(new URL('..', import.meta.url)),
    plugins: [vue()],
    test: {
        environment: 'jsdom',
        include: ['tests/unit/**/*.test.ts'],
        globals: true,
        setupFiles: ['tests/unit/setupIndexedDb.ts']
    }
});
