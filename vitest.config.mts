import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/**
 * Lo que vitest no ejecuta.
 *
 * Las pruebas de punta a punta las corre Playwright: necesitan un navegador y el servidor
 * levantado.
 */
const EXCLUIDAS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/__boundary-fixture__/**',
  '**/e2e/**',
  '**/.next/**',
];

/**
 * Los archivos que sustituyen un MODULO con `vi.mock`, y por eso necesitan registro nuevo.
 *
 * Hoy es uno solo. Si aparece otro tiene que venir aqui, y no hace falta acordarse: lo exige
 * `tools/coherence/simulacros.spec.ts`, que compara esta lista con los archivos que escriben
 * `vi.mock`. Se exporta para que esa guarda lea la lista de VERDAD y no una copia suya.
 */
export const CON_SIMULACRO = ['packages/auth/src/auth.spec.ts'];

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
     * Va junto con `isolate: false`, que es de donde sale el grueso del ahorro.
     */
    fsModuleCache: true,

    // Aisla el estado compartido de la aplicacion: ver vitest.setup.mts.
    setupFiles: ['./vitest.setup.mts'],
    // Las pruebas de punta a punta las ejecuta Playwright, no vitest: necesitan un navegador
    // y el servidor levantado. Se excluyen aqui para que `npm test` siga siendo rapido.
    exclude: EXCLUIDAS,

    /*
     * Dos grupos, y la frontera es una sola cosa: quien sustituye un MODULO.
     *
     * `vi.mock` intercambia un modulo antes de que se evalue el arbol que lo usa. Con el registro
     * compartido, ese arbol puede estar evaluado ya —lo trajo un archivo anterior del mismo
     * proceso— y entonces el simulacro llega tarde: el codigo bajo prueba se quedo con el modulo
     * de verdad. No es teorico. Con `isolate: false` a secas, `auth.spec.ts` fallaba en tres de
     * cada cinco barajadas: contaba CERO llamadas a `verify` donde espera una por rama.
     *
     * Y falla con razon, que es lo unico bueno del asunto: esa prueba afirma sobre las llamadas
     * del doble, asi que un simulacro que no se aplica la rompe en vez de dejarla pasar sin
     * comprobar nada. Una que solo hubiera sustituido para «no tocar disco» se habria quedado
     * verde y muda.
     *
     * Asi que el archivo que simula corre aparte y con su registro nuevo. Es un archivo de 1898
     * pruebas: el ahorro se mantiene entero.
     */
    projects: [
      {
        extends: true,
        test: {
          name: 'rapidas',
          /*
           * Los procesos se REUTILIZAN entre archivos: doce segundos pasan a cuatro.
           *
           * Con aislamiento, cada archivo evalua de cero todo su arbol de modulos: eran 268
           * modulos evaluados 810 veces, y el 42% del tiempo de la suite se iba solo en importar.
           * Reutilizando el proceso se evaluan una vez por proceso, y ese 42% desaparece.
           *
           * Lo que se paga a cambio, y lo que hubo que arreglar antes de poder cobrarlo: el
           * registro de modulos deja de ser nuevo por archivo, asi que cualquier modulo que
           * CAPTURE algo al evaluarse se lo lleva puesto al archivo siguiente. Habia uno, y era el
           * peor posible: `almacenCompartido.ts` leia `CACHE_DIR` en un `const`, de modo que el
           * segundo archivo de cada proceso habria seguido escribiendo en el directorio temporal
           * del primero y el aislamiento que promete `vitest.setup.mts` habria quedado anulado EN
           * SILENCIO —la suite en verde, las pruebas pisandose—. Ahora el almacen pregunta por el
           * directorio en cada operacion, y `almacenCompartido.spec.ts` lo ata: enrojece si
           * alguien vuelve a capturarlo.
           */
          isolate: false,
          include: ['**/*.spec.ts'],
          exclude: [...EXCLUIDAS, ...CON_SIMULACRO],
        },
      },
      {
        extends: true,
        test: {
          name: 'con-simulacro',
          isolate: true,
          include: CON_SIMULACRO,
        },
      },
    ],
  },
});
