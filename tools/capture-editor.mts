/**
 * Capturas del editor de modulos, para revision visual.
 *
 * El editor no es el panel, y por eso no cae en `capture-admin.mts`. Lo que hay que poder mirar
 * aqui son los ESTADOS: recien abierto, con un objeto que se guardo solo, y despues de descartar.
 * Son tres fotos de la misma pantalla, y lo que las separa es lo que hace el autoguardado: entre
 * la primera y la segunda no se pulso ningun boton.
 *
 *   npx nx run shell:build
 *   CACHE_DIR=.cache-shot npx tsx tools/populate-cache.mts --connector mock --dir .cache-shot
 *   CACHE_DIR=.cache-shot AUTH_PEPPER=x SEED_DEMO_CREDENTIALS=1 npx next start apps/shell --port 4310
 *   npx tsx tools/capture-editor.mts capturas
 */
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';
import {
  DEMO_KEY,
  SECRETO_TOTP_DEMO,
  mailUser,
  totpCodeOf,
} from '../apps/shell/src/server/demoCredentials';

const base = process.env['BASE_URL'] ?? 'http://localhost:4310';
const salida = process.argv[2] ?? 'capturas';
mkdirSync(salida, { recursive: true });

const navegador = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const pagina = await (
  await navegador.newContext({ viewport: { width: 1440, height: 980 } })
).newPage();

const entrar = async (userId: string) => {
  const r = await pagina.request.post(`${base}/api/sign-in`, {
    data: { mail: mailUser(userId), clave: DEMO_KEY, code: totpCodeOf(SECRETO_TOTP_DEMO) },
  });
  if (!r.ok()) throw new Error(`no se pudo entrar como ${userId}: ${r.status()}`);
};

/**
 * El editor esta al dia: nada pendiente, nada en vuelo, nada dibujandose.
 *
 * Se espera por SELECTOR y no con `waitForFunction`: el cuerpo de esa funcion corre en el
 * navegador, asi que toca `document`, y este archivo se compila con la configuracion de Node —
 * donde `document` no existe—. Compilaba porque nadie habia ejecutado el typecheck del
 * repositorio entero sobre el.
 */
const alDia = async () => {
  await pagina.waitForSelector('.editor[data-dirty="no"][data-saving="no"][data-drawing="no"]');
};

const foto = async (nombre: string) => {
  await pagina.mouse.move(700, 700);
  await pagina.waitForTimeout(250);
  await pagina.screenshot({ path: `${salida}/${nombre}.png`, fullPage: true });
  console.log(nombre);
};

await entrar('u-admin');

const slug = `editor-captura-${Date.now()}`;
await pagina.goto(`${base}/editor`);
await pagina.getByTestId('new-module-name').fill('Demora por materia');
await pagina.getByTestId('new-module-slug').fill(slug);
await pagina.getByTestId('create-module').click();
await pagina.goto(`${base}/editor/${slug}`);
await alDia();
await foto('30-editor-vacio');

// Un objeto colocado y ya guardado SIN haber pulsado nada: es lo que hace el autoguardado.
await pagina.getByTestId('add-tarjeta-kpi').click();
await alDia();
await foto('31-editor-autoguardado');

// Y descartar, que deshace la sesion entera y deja el modulo como se abrio.
await pagina.getByTestId('descartar-borrador').click();
await alDia();
await foto('32-editor-descartado');

/*
 * El contenedor expandible, en sus dos estados.
 *
 * En el modulo publicado y no en el lienzo: lo que hay que ver es que al abrirlo lo de abajo BAJA,
 * y en el editor cada objeto lleva encima su capa de seleccion.
 */
await pagina.goto(`${base}/m/composicion/contenedores`);
await pagina.waitForLoadState('networkidle');
await foto('33-expandible-cerrado');
await pagina.getByTestId('chiclet').click();
await pagina.waitForTimeout(400);
await foto('34-expandible-abierto');

await navegador.close();
