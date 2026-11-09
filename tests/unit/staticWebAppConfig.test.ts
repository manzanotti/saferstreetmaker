import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const configPath = resolve(process.cwd(), 'src', 'public', 'staticwebapp.config.json');

describe('Azure Static Web Apps configuration', () => {
    it('sends an origin-only referrer with cross-origin tile requests', async () => {
        const config: { globalHeaders: Record<string, string> } = JSON.parse(
            await readFile(configPath, 'utf8')
        );

        expect(config.globalHeaders['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    });
});
