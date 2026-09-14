import { chromium } from 'playwright';
import { createHmac } from 'node:crypto';

const BASE = 'http://localhost:4399';
const SECRETO = 'JBSWY3DPEHPK3PXP';

/** TOTP de seis digitos, RFC 6238, igual que el de las pruebas. */
function totp(secreto) {
  const base32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of secreto.toUpperCase().replace(/=+$/, '')) {
    bits += base32.indexOf(c).toString(2).padStart(5, '0');
  }
  const bytes = Buffer.from((bits.match(/.{8}/g) ?? []).map((b) => parseInt(b, 2)));
  const contador = Buffer.alloc(8);
  contador.writeUInt32BE(Math.floor(Date.now() / 1000 / 30), 4);
  const h = createHmac('sha1', bytes).update(contador).digest();
  const o = h[h.length - 1] & 0x0f;
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, '0');
}

const paso = (n, t) => console.log(`  ${n}. ${t}`);

const navegador = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const contexto = await navegador.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await contexto.newPage();

const errores = [];
page.on('pageerror', (e) => errores.push(`pageerror: ${e.message}`));
page.on('response', (r) => {
  if (r.status() >= 500) errores.push(`${r.status()} ${r.url()}`);
});

paso(1, 'Inicio de sesion como Administrador');
const acceso = await page.request.post(`${BASE}/api/acceso`, {
  data: { mail: 'u-admin@poderjudicial.gob.do', clave: 'Demostracion-2026!', code: totp(SECRETO) },
});
if (!acceso.ok()) throw new Error(`acceso ${acceso.status()} ${await acceso.text()}`);

const slug = `demostracion-${Date.now()}`;
paso(2, `Creacion del modulo ${slug} por el formulario del editor`);
await page.goto(`${BASE}/editor`);
await page.getByTestId('new-module-name').fill('Demostracion completa');
await page.getByTestId('new-module-slug').fill(slug);
await page.getByTestId('create-module').click();
await page.waitForSelector(`[data-testid="row-${slug}"]`);
await page.goto(`${BASE}/editor/${slug}`);

const guardado = () => page.waitForFunction(
  () => document.querySelector('.editor')?.getAttribute('data-saving') === 'no',
  null, { timeout: 20000 },
);

/** Coloca un objeto desde la paleta y espera a que el editor lo guarde. */
async function colocar(objectId) {
  await page.getByTestId('tab-objetos').click();
  const boton = page.getByTestId(`add-${objectId}`);
  if ((await boton.count()) === 0) return console.log(`     (sin ${objectId} en la paleta)`);
  await boton.click();
  await guardado();
  console.log(`     + ${objectId}`);
}

paso(3, 'Graficos');
for (const o of ['barras', 'lineas', 'pastel', 'medidor']) await colocar(o);

paso(4, 'Contenedores y elementos');
for (const o of ['contenedor-pestanas', 'titulo-de-seccion', 'forma']) await colocar(o);

paso(5, 'Tabla y panel de filtros');
for (const o of ['tabla', 'panel-de-filtros']) await colocar(o);

paso(6, 'Personalizacion: acento y subtitulo del primer objeto');
const primero = await page.locator('[data-testid^="block-obj-"]').first().getAttribute('data-testid');
const item = (primero ?? '').replace('block-', '');
await page.locator('[data-testid^="block-obj-"]').first().click();
await page.getByTestId('tab-formato').click();
await page.locator('.editor-panel details').evaluateAll((n) => n.forEach((d) => (d.open = true)));

const subtitulo = page.getByTestId(`pres-${item}-subtitulo`);
if (await subtitulo.count()) {
  await subtitulo.fill('Casos pendientes por distrito, 2026');
  await subtitulo.blur();
  await guardado();
  console.log('     + subtitulo');
}
const acento = page.getByTestId(`pres-${item}-acento`);
if (await acento.count()) {
  const opciones = await acento.locator('option').allTextContents();
  if (opciones.length > 1) {
    await acento.selectOption({ index: 1 });
    await guardado();
    console.log(`     + acento: ${opciones[1]}`);
  }
}

paso(7, 'Captura del editor');
await page.waitForTimeout(1200);
await page.screenshot({ path: '/tmp/claude-0/demo-editor.png', fullPage: false });

paso(8, 'Captura del modulo publicado, como lo ve quien mira');
await page.goto(`${BASE}/m/${slug}`);
await page.waitForTimeout(2500);
await page.screenshot({ path: '/tmp/claude-0/demo-modulo.png', fullPage: false });

const bloques = await page.locator('[data-testid^="block"], .objeto, .object').count();
console.log(`\n  Objetos dibujados en el modulo: ${bloques}`);
console.log(errores.length ? `  ERRORES: ${errores.join(' | ')}` : '  Sin errores de pagina ni 5xx.');

await navegador.close();
