import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? 'github' : 'list',
  use: { baseURL: 'http://localhost:4200', browserName: 'chromium' },
  webServer: {
    command: 'npm start -- --port 4200',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env['CI'],
    timeout: 180_000,
  },
});
