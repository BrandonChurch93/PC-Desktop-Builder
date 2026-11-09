import { execFileSync } from 'node:child_process';
import process from 'node:process';
import { defineConfig, devices } from '@playwright/test';

// The runner picks a free port once and hands it to its workers through the environment.
// Every server in this project binds 127.0.0.1 by number, because localhost can mean ::1 on macOS.
process.env.PCB_PORT ??= execFileSync(process.execPath, ['scripts/free-port.mjs'], { encoding: 'utf8' }).trim();
const port = Number(process.env.PCB_PORT);
const gpuArgs = process.platform === 'darwin' ? ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=metal'] : ['--ignore-gpu-blocklist'];

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 180_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: { baseURL: `http://127.0.0.1:${port}` },
  webServer: { command: `node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port ${port} --strictPort`, url: `http://127.0.0.1:${port}`, reuseExistingServer: false, timeout: 120_000 },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], channel: 'chromium', launchOptions: { args: gpuArgs } } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
});
