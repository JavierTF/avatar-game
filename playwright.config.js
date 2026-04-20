import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './src/e2e',
    use: {
        baseURL: 'http://localhost:5173',
        headless: true,
    },
    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:5173',
        reuseExistingServer: true,
        timeout: 15000,
    },
});
