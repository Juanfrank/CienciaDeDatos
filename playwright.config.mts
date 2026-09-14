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

/** Cuantos workers, y por tanto cuantas parejas de instancias se levantan. */
const WORKERS = Number(process.env['E2E_WORKERS'] ?? 3);

const PIMIENTA = 'pimienta-de-pruebas-e2e';

/**
 * Las pruebas que tocan la semilla de identidad y gobierno.
 *
 * Todas las demas escriben solo lo que ellas mismas crean —un modulo con un slug con reloj, sus
 * marcadores, sus alertas, su vista personal— y pueden repartirse entre workers sin mirarse.
 * Estas seis no: crean cuentas, bloquean usuarios por intentos fallidos, mueven carpetas del
 * arbol, amplian ambitos, cambian roles y publican modulos en la organizacion general. Todo eso
 * es estado SEMBRADO contra el que el resto de la suite inicia sesion.
 *
 * Corren en su propio pase con UN worker —`npm run e2e` lanza los dos proyectos por separado—,
 * asi que conservan exactamente la semantica de antes: un almacen, un orden. Playwright no sabe
 * limitar los workers de un proyecto concreto, y repartirlas confiando en que cada worker tiene
 * su almacen seria suponer que ninguna depende de otra. No lo he comprobado, y suponerlo es como
 * se rompen estas cosas.
 *
 * `multiinstancia` y `personalization` estan ademas por otro motivo: hablan con la SEGUNDA
 * instancia, que es lo que comprueba el criterio de escalado horizontal de la seccion 9.
 */
/**
 * Lo que solo cambia cuando cambia un objeto del catalogo.
 *
 * Cincuenta y ocho pruebas comprueban la MISMA cosa objeto a objeto: que cada pagina de objetos
 * nuevos pasa axe, que pasa el contraste en tema oscuro, que no desborda en movil, y que cada
 * objeto del catalogo ofrece en el panel las claves que declara. Son 171 de los 761 segundos de
 * la suite —el 22%— y no dependen de nada que se toque a diario: dependen del catalogo.
 *
 * No se borran, que perderia cobertura que las secciones 4.2 y 4.9 exigen objeto a objeto. Se
 * atan a lo que las hace cambiar: `shell:e2e-catalogo` declara como entradas el repositorio de
 * objetos, la presentacion, los renderizadores y los temas. Se crea o se edita un objeto y
 * corren enteras; no se toca ninguno y aciertan en cache.
 */
const CATALOGO = /@catalogo/;

const SECUENCIALES = [
  'admin.spec.ts',
  'accounts.spec.ts',
  'login.spec.ts',
  'multiinstancia.spec.ts',
  'personalization.spec.ts',
  'editor.spec.ts',
];

/**
 * Una pareja de servidores por worker, cada una sobre su propio almacen.
 *
 * Son DOS instancias sobre el MISMO almacen compartido, que es la situacion de App Service con
 * escalado horizontal y la unica forma de comprobar de verdad el criterio de la seccion 9 —
 * "escala a mas de una instancia sin perdida de sesion ni de estado de personalizacion". Con una
 * sola instancia no se comprobaria nada: el fallo que se busca es precisamente el estado que no
 * sale del proceso.
 */
function servidoresDe(indice: number) {
  const principal = 4310 + indice * 2;
  const segunda = principal + 1;
  const cache = `.cache-e2e-${indice}`;
  const entorno = `CACHE_DIR=${cache} AUTH_PEPPER=${PIMIENTA} `;

  return [
    {
      // Se borra el almacen antes de poblar. Desde que el estado de aplicacion —gobierno,
      // sesiones, marcadores, auditoria— vive en disco y no en el proceso, sobrevive entre
      // ejecuciones: sin esto, una prueba que amplia un ambito deja esa ampliacion puesta para
      // la siguiente ejecucion y las que asumen el estado sembrado empiezan a fallar sin
      // motivo aparente.
      command:
        `rm -rf ${cache} && ` +
        `npx tsx tools/poblar-cache.mts --connector mock --dir ${cache} && ` +
        `${entorno}npx next start apps/shell --port ${principal}`,
      url: `http://localhost:${principal}/health`,
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      // La MISMA pimienta que la otra instancia: con dos distintas, los hashes escritos por una
      // no verificarian en la otra y la sesion se perderia al cambiar de instancia — que es
      // precisamente lo que las pruebas de multiinstancia comprueban que no pasa.
      command: `${entorno}npx next start apps/shell --port ${segunda}`,
      url: `http://localhost:${segunda}/health`,
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ];
}

export default defineConfig({
  testDir: 'apps/shell/e2e',
  timeout: 30_000,
  // Por archivo, nunca por prueba: dentro de un archivo el orden es parte de lo que se prueba.
  fullyParallel: false,
  workers: WORKERS,
  reporter: [['list']],
  use: {
    trace: 'off',
    launchOptions: { executablePath: '/opt/pw-browsers/chromium' },
  },
  projects: [
    {
      name: 'paralelo',
      testIgnore: SECUENCIALES,
      grepInvert: CATALOGO,
      /*
       * El doble de margen que en solitario.
       *
       * No es que las pruebas hagan mas: es que compiten. Con tres workers hay seis instancias de
       * Next y tres navegadores sobre cuatro nucleos, y lo que tarda seis segundos con la maquina
       * para uno puede tardar veinticinco. El limite esta para cazar una espera que no termina
       * nunca, no para medir la carga de la maquina.
       */
      timeout: 60_000,
    },
    {
      name: 'secuencial',
      testMatch: SECUENCIALES,
      grepInvert: CATALOGO,
    },
    {
      // Lo que se comprueba objeto a objeto, con su propio pase y su propia cache en nx.
      name: 'catalogo',
      grep: CATALOGO,
      timeout: 60_000,
    },
  ],
  webServer: Array.from({ length: WORKERS }, (_, i) => servidoresDe(i)).flat(),
});
