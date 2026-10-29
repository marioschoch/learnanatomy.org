import { defineConfig, devices } from '@playwright/test';

// PW_PORT lets parallel runs (one per agent) use their own preview server and build folder.
const PORT = Number(process.env.PW_PORT ?? 4173);
const OUT = `.e2e/${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  // The QA specs (Phase 3) need the real assets in public/models/ and a GPU: opt in with QA_GPU=1 / QA_PERF=1.
  testIgnore: process.env.QA_GPU || process.env.QA_PERF ? [] : ['**/qa-*.spec.ts'],
  outputDir: `./test-results/${PORT}`,
  // SwiftShader (no GPU) renders X-ray / transparent passes slowly; 60 s was not enough with 2 workers.
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: `playwright-report/${PORT}` }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
      },
    },
    {
      name: 'phone',
      use: {
        ...devices['Pixel 7'],
        viewport: { width: 390, height: 844 },
        launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
      },
    },
  ],
  webServer: {
    // Type errors are caught by `npm run typecheck`; e2e only needs a bundle.
    command: `npx vite build --outDir ${OUT} --emptyOutDir && npx vite preview --outDir ${OUT} --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
