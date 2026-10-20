// Pruebas de punta a punta (Playwright): `npm run test:e2e`.
// Compila la app apuntando a un Supabase ficticio y la sirve con `vite preview`;
// cada prueba intercepta Supabase con e2e/fake-supabase.ts (no toca ningún proyecto real).
import { defineConfig, devices } from '@playwright/test'
import { ANON_KEY, SUPABASE_URL } from './e2e/fake-supabase'

const PORT = 4173

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/`,
    locale: 'es-CL',
    timezoneId: 'America/Santiago',
    // El service worker no debe interponerse entre la app y el Supabase simulado.
    serviceWorkers: 'block',
    // Sin animaciones: las cifras muestran su valor final de inmediato.
    contextOptions: { reducedMotion: 'reduce' },
    trace: 'retain-on-failure',
    // Para usar un Chromium ya instalado en vez del que descarga Playwright.
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined },
  },
  projects: [
    { name: 'celular', use: { ...devices['Pixel 7'] } },
    { name: 'escritorio', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `vite build --outDir dist-e2e --emptyOutDir && vite preview --outDir dist-e2e --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      VITE_SUPABASE_URL: SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: ANON_KEY,
      VITE_TURNSTILE_SITE_KEY: '',
      VITE_BASE: '/',
    },
  },
})
