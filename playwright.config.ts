import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './test-e2e',
  timeout: 30 * 1000,
  retries: 0,
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'Electron',
      use: {
        ...devices['Desktop Chrome'],
        // Electron-specific settings can go here
      },
    },
  ],
});
