import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@app/data-contracts-server': r('./packages/data-contracts/server/src/index.ts'),
      '@app/data-contracts': r('./packages/data-contracts/types/src/index.ts'),
      '@app/access-control': r('./packages/access-control/src/index.ts'),
      '@app/identity-db': r('./packages/identity-db/src/index.ts'),
      '@app/observability': r('./packages/observability/src/index.ts'),
      '@app/module-model': r('./packages/module-model/src/index.ts'),
      '@app/export': r('./packages/export/src/index.ts'),
      '@app/alerts': r('./packages/alerts/src/index.ts'),
      '@app/nl-query': r('./packages/nl-query/src/index.ts'),
      '@app/ui-components': r('./packages/ui-components/src/index.ts'),
      '@app/auth': r('./packages/auth/src/index.ts'),
      '@app/caching': r('./packages/caching/src/index.ts'),
      '@app/config': r('./packages/config/src/index.ts'),
      '@app/design-tokens': r('./packages/design-tokens/src/index.ts'),
      '@app/testing-utils': r('./packages/testing-utils/src/index.ts'),
    },
  },
  test: {
    /*
     * La transformacion se guarda entre ejecuciones, en `node_modules/.vitest-cache`.
     *
     * Transformar era el 18% del tiempo de la suite y se rehacia entero en cada pasada, aunque no
     * hubiera cambiado un archivo. Con la cache baja al 6%: doce segundos pasan a once, y eso en
     * una suite que corre en cada `npm run verify`.
     *
     * Esto NO es lo mismo que `isolate: false`, que vitest sugiere en el mismo mensaje y que
     * ahorraria mucho mas —de doce segundos a cuatro—. Ese no se puede tomar todavia: reutiliza el
     * registro de modulos entre archivos, y `almacenCompartido.ts` lee `CACHE_DIR` AL EVALUARSE,
     * asi que el segundo archivo de cada proceso seguiria escribiendo en el directorio del
     * primero. El aislamiento que promete `vitest.setup.mts` quedaria anulado en silencio, y la
     * suite seguiria en verde. Comprobado con dos pruebas que comparan `CACHE_DIR` con
     * `process.env.CACHE_DIR`: sin aislar, no coinciden.
     */
    fsModuleCache: true,
    include: ['**/*.spec.ts'],
    // Aisla el estado compartido de la aplicacion: ver vitest.setup.mts.
    setupFiles: ['./vitest.setup.mts'],
    // Las pruebas de punta a punta las ejecuta Playwright, no vitest: necesitan un navegador
    // y el servidor levantado. Se excluyen aqui para que `npm test` siga siendo rapido.
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/__boundary-fixture__/**',
      '**/e2e/**',
      '**/.next/**',
    ],
  },
});
