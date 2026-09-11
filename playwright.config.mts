import { defineConfig } from '@playwright/test';

/**
 * Pruebas de punta a punta contra el shell real.
 *
 * Verifican en un navegador de verdad varios criterios de la seccion 9 que no se pueden
 * comprobar de otra forma — en particular el del principio 1: que ninguna peticion del
 * navegador salga fuera de la API de la propia aplicacion.
 *
 * El cache se puebla antes de arrancar el servidor, como en produccion: el job es un proceso
 * aparte y el servidor solo lee lo que encuentre ya poblado.
 */
export default defineConfig({
  testDir: 'apps/shell/e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4310',
    trace: 'off',
    launchOptions: { executablePath: '/opt/pw-browsers/chromium' },
  },
  /**
   * DOS instancias sobre el MISMO almacen compartido.
   *
   * Es la situacion de App Service con escalado horizontal, y la unica forma de comprobar de
   * verdad el criterio de la seccion 9 —"escala a mas de una instancia sin perdida de sesion ni
   * de estado de personalizacion"—. Simularlo con una sola instancia no comprobaria nada: el
   * fallo que se quiere detectar es precisamente el estado que no sale del proceso.
   */
  webServer: [
    {
      command:
        // Se borra el almacen antes de poblar. Desde que el estado de aplicacion —gobierno,
        // sesiones, marcadores, auditoria— vive en disco y no en el proceso, sobrevive entre
        // ejecuciones: sin esto, una prueba que amplia un ambito deja esa ampliacion puesta para
        // la siguiente ejecucion y las que asumen el estado sembrado empiezan a fallar sin
        // motivo aparente.
        'rm -rf .cache-e2e && ' +
        'npx tsx tools/poblar-cache.mts --connector mock --dir .cache-e2e && ' +
        'CACHE_DIR=.cache-e2e npx next start apps/shell --port 4310',
      url: 'http://localhost:4310/health',
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'CACHE_DIR=.cache-e2e npx next start apps/shell --port 4311',
      url: 'http://localhost:4311/health',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
