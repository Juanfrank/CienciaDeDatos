/**
 * Capturas del acceso, las paginas del editor y el menu contextual.
 *
 *   npx nx run shell:build
 *   CACHE_DIR=.cache-shot npx tsx tools/populate-cache.mts --connector mock --dir .cache-shot
 *   CACHE_DIR=.cache-shot AUTH_PEPPER=x SEED_DEMO_CREDENTIALS=1 npx next start apps/shell --port 4310
 *   npx tsx tools/capture-f69.mts capturas
 */
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { DEMO_KEY, SECRETO_TOTP_DEMO, mailUser, totpCodeOf } from '../apps/shell/src/server/demoCredentials';

const base = process.env['BASE_URL'] ?? 'http://localhost:4310';
const salida = process.argv[2] ?? 'capturas';
mkdirSync(salida, { recursive: true });

const navegador = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const pagina = await (await navegador.newContext({ viewport: { width: 1440, height: 980 } })).newPage();

let n = 16;
const nombre = (label: string) => `${String(++n).padStart(2, '0')}-${label}`;
async function foto(label: string) {
  await pagina.waitForLoadState('networkidle');
  await pagina.mouse.move(1200, 900);
  await pagina.waitForTimeout(250);
  await pagina.screenshot({ path: `${salida}/${nombre(label)}.png`, fullPage: true });
}
async function trozo(selector: string, label: string, margen = 24) {
  await pagina.waitForTimeout(250);
  const c = await pagina.locator(selector).first().boundingBox();
  if (!c) throw new Error(`no se encontro ${selector}`);
  await pagina.screenshot({
    path: `${salida}/${nombre(label)}.png`,
    clip: { x: Math.max(0, c.x - margen), y: Math.max(0, c.y - margen), width: c.width + margen * 2, height: c.height + margen * 2 },
  });
}
const entrar = async (userId: string) => {
  const r = await pagina.request.post(`${base}/api/sign-in`, {
    data: { mail: mailUser(userId), clave: DEMO_KEY, code: totpCodeOf(SECRETO_TOTP_DEMO) },
  });
  if (!r.ok()) throw new Error(`no se pudo entrar: ${r.status()}`);
};

/* ── La pantalla de acceso ─────────────────────────────────────────────────────────────────── */
await pagina.goto(`${base}/sign-in`);
await foto('acceso');
// Con el correo y la clave puestos: el segundo factor solo aparece cuando la cuenta lo tiene.
await pagina.getByTestId('login-mail').fill(mailUser('u-ana'));
await pagina.getByTestId('key-login').fill(DEMO_KEY);
await foto('acceso-relleno');

/* ── Las paginas del editor ────────────────────────────────────────────────────────────────── */
await entrar('u-admin');
const slug = 'demora-por-distrito';
await pagina.goto(`${base}/editor/${slug}`);
await pagina.waitForLoadState('networkidle');
await trozo('[data-testid="paginas-editor"]', 'editor-barra-de-paginas', 16);
await pagina.getByTestId('anadir-pagina').click();
await pagina.waitForTimeout(1200);
await trozo('[data-testid="paginas-editor"]', 'editor-pagina-recien-creada', 16);
await foto('editor-con-pagina-nueva');

/* ── El menu contextual, en el editor ──────────────────────────────────────────────────────── */
// De vuelta a una pagina CON objetos: la recien creada esta vacia a proposito.
await pagina.getByTestId('pagina-general').click();
await pagina.waitForTimeout(1200);
const bloque = pagina.locator('[data-testid^="block-"]').first();
await bloque.click({ button: 'right' });
await pagina.waitForTimeout(500);
await foto('menu-en-el-editor');

/* ── Y en el visor ─────────────────────────────────────────────────────────────────────────── */
await entrar('u-ana');
await pagina.goto(`${base}/m/casos-pendientes`);
await pagina.waitForLoadState('networkidle');
await pagina.locator('.objeto', { hasText: 'Pendientes por distrito' }).first().locator('.object__header').click({ button: 'right' });
await pagina.waitForTimeout(500);
await foto('menu-en-el-visor');

// Y los complementos ya reducidos, de cerca.
await pagina.keyboard.press('Escape');
await pagina.waitForTimeout(300);
await trozo('.objeto:has([data-testid="drill-Pendientes por distrito"]) .object__header', 'complementos-mas-pequenos', 12);

await navegador.close();
console.log(`${n - 16} capturas en ${salida}/`);
