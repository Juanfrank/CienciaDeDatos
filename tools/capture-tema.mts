/**
 * Capturas de un tema sobre el modulo de doce paginas.
 *
 *   npx nx run shell:build
 *   CACHE_DIR=.cache-shot npx tsx tools/populate-cache.mts --connector mock --dir .cache-shot
 *   CACHE_DIR=.cache-shot AUTH_PEPPER=x SEED_DEMO_CREDENTIALS=1 npx next start apps/shell --port 4310
 *   npx tsx tools/capture-tema.mts capturas linea-grafica
 *
 * El tema se activa por la API y se DEVUELVE al de antes al terminar, pase lo que pase: activar un
 * tema repinta la aplicacion entera para toda la institucion, y dejarlo puesto porque un script se
 * cayo a la mitad seria cambiar la marca del Poder Judicial para sacar una foto.
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
const temaId = process.argv[3] ?? 'linea-grafica';
mkdirSync(salida, { recursive: true });

/** El modulo de doce paginas, y las que se fotografian. */
const MODULO = 'composicion';
const PAGINAS = [
  'elementos',
  'graficos',
  'familia',
  'proporcion',
  'relacion',
  'flujo',
  'referencia',
  'detalle',
  'multiplos',
  'condicional',
  'contenedores',
  'complementos',
];

const navegador = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const contexto = await navegador.newContext({ viewport: { width: 1440, height: 980 } });
const pagina = await contexto.newPage();

let n = 0;
async function foto(label: string) {
  await pagina.waitForLoadState('networkidle');
  await pagina.mouse.move(1380, 940);
  await pagina.waitForTimeout(400);
  await pagina.screenshot({
    path: `${salida}/${String(++n).padStart(2, '0')}-${label}.png`,
    fullPage: true,
  });
}

/** El token anti-CSRF, igual que lo pone el navegador: leido de su cookie y devuelto por cabecera. */
async function entrar(userId: string) {
  const r = await pagina.request.post(`${base}/api/sign-in`, {
    data: { mail: mailUser(userId), clave: DEMO_KEY, code: totpCodeOf(SECRETO_TOTP_DEMO) },
  });
  if (!r.ok()) throw new Error(`no se pudo entrar: ${r.status()} ${await r.text()}`);

  const cookie = (await contexto.cookies()).find((c) => c.name === 'csrf');
  if (cookie) await contexto.setExtraHTTPHeaders({ 'x-csrf-token': cookie.value });
}

async function activar(id: string) {
  const r = await pagina.request.post(`${base}/api/admin/themes`, {
    data: { accion: 'activar', themeId: id },
  });
  if (!r.ok()) throw new Error(`no se pudo activar '${id}': ${r.status()} ${await r.text()}`);
}

/**
 * El tema servido ahora mismo, leido de la pagina.
 *
 * De `body[data-tema]`, que ya lo lleva, y no de una ruta nueva: anadir un GET al panel para que
 * un script de capturas pueda preguntar seria abrir superficie de API para una foto.
 */
async function activo(): Promise<string> {
  await pagina.goto(`${base}/`);
  return (await pagina.locator('body').getAttribute('data-tema')) ?? 'institucional';
}

async function recorrer(etiqueta: string) {
  await pagina.goto(`${base}/m/${MODULO}`);
  await foto(`${etiqueta}-inicio`);

  for (const slug of PAGINAS) {
    await pagina.goto(`${base}/m/${MODULO}/${slug}`);
    await foto(`${etiqueta}-${slug}`);
  }
}

/** El modo de color se elige con la cookie, que es lo que hace la pantalla de preferencias. */
async function enModo(modo: 'light' | 'dark', fn: () => Promise<void>) {
  await contexto.addCookies([{ name: 'tema', value: modo, url: base }]);
  await fn();
}

await entrar('u-admin');
const anterior = await activo();

try {
  await activar(temaId);
  await enModo('light', () => recorrer(`${temaId}-claro`));
  await enModo('dark', () => recorrer(`${temaId}-oscuro`));

  // Y la misma primera pagina con el tema de antes, para poder comparar.
  await activar(anterior);
  await enModo('light', async () => {
    await pagina.goto(`${base}/m/${MODULO}`);
    await foto(`${anterior}-claro-comparacion`);
  });
} finally {
  // La red de seguridad. Si NI ASI se puede devolver el tema, se dice a gritos: la aplicacion se
  // queda pintada de otra cosa para todo el mundo, y eso no puede irse en silencio.
  await activar(anterior).catch((fallo: unknown) => {
    console.error(`ATENCION: el tema activo sigue siendo otro, devuelvelo a '${anterior}'`, fallo);
  });
  await navegador.close();
}

console.log(`${n} capturas en ${salida}/`);
