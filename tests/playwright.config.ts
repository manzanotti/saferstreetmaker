import os from 'node:os';
import { defineConfig, devices } from '@playwright/test';

const localWorkerCount = Math.max(1, Math.min(4, os.availableParallelism()));

export default defineConfig({
    testDir: './playwright',
    testMatch: '*.spec.ts',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 2 : localWorkerCount,
    reporter: 'html',
    use: {
        baseURL: 'http://localhost:1234',
        trace: 'on-first-retry'
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] }
        }
    ],
    webServer: {
        command: 'yarn start',
        url: 'http://localhost:1234',
        reuseExistingServer: !process.env.CI,
        timeout: 30000
    }
});
