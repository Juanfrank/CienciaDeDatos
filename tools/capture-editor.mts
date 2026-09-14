/**
 * Capturas del editor de modulos, para revision visual.
 *
 * El editor no es el panel, y por eso no cae en `capture-admin.mts`. Lo que hay que poder mirar
 * aqui son los ESTADOS: recien abierto, con cambios sin guardar, y despues de guardar. Son tres
 * fotos distintas de la misma pantalla, y la diferencia entre ellas es justo lo que cambio cuando
 * el editor dejo de guardar solo.
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

/** El editor esta al dia: ni guardando ni dibujando. */
const alDia = async () => {
  await pagina.waitForFunction(() => {
    const el = document.querySelector('.editor');
    return el?.getAttribute('data-saving') === 'no' && el?.getAttribute('data-drawing') === 'no';
  });
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

// Un objeto colocado y SIN guardar: es el estado que antes no existia.
await pagina.getByTestId('add-tarjeta-kpi').click();
await alDia();
await foto('31-editor-sin-guardar');

await pagina.getByTestId('guardar-borrador').click();
await alDia();
await foto('32-editor-guardado');

await navegador.close();
