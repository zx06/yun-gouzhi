import { defineConfig, devices } from '@playwright/test'

/**
 * 浏览器 e2e：
 *   npm run test:e2e                     → 构建并启动 vite preview，跑全部用例
 *   E2E_BASE_URL=https://crochet.xuzhuo.xyz npm run test:e2e → 只跑 @smoke 用例，对线上冒烟
 * 本机可用 PW_CHROMIUM_PATH=/usr/bin/google-chrome 指定已装的 Chrome。
 */
const live = process.env.E2E_BASE_URL?.replace(/\/$/, '')
const CI = !!process.env.CI
const PORT = 4173

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  workers: CI ? 2 : undefined,
  timeout: 120_000,
  expect: { timeout: 10_000 },
  grep: live ? /@smoke/ : undefined,
  reporter: CI ? [['github'], ['list'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: live ?? `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    acceptDownloads: true,
    launchOptions: {
      executablePath: process.env.PW_CHROMIUM_PATH || undefined,
      // 无 GPU 环境下让 PixiJS 用软件 WebGL
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 860 } },
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
    },
  ],
  webServer: live
    ? undefined
    : {
        command: `npx vite build && npx vite preview --port ${PORT} --strictPort`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: !CI,
        timeout: 180_000,
      },
})
