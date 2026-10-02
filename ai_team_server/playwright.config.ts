
import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './test/playwright',
    use: {
        baseURL: 'http://localhost:8000',
        extraHTTPHeaders: {
            'Accept': 'application/json',
        },
    },
    webServer: {
        command: 'npm run start',
        url: 'http://localhost:8000',
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
    },
});
