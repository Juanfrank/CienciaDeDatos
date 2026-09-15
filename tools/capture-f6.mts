/**
 * Capturas de lo entregado en la tanda F6.5–F6.8 y F5.53, para revision visual.
 *
 * No captura pantallas «a ver que sale»: cada una existe para ensenar UNA cosa concreta de lo que
 * se cambio, y varias van recortadas al elemento en vez de a la pagina entera — un detalle de
 * veinte pixeles dentro de una captura de 1440 no se ve, y una captura que no deja ver lo que
 * vino a ensenar no sirve de nada.
 *
 *   npx nx run shell:build
 *   CACHE_DIR=.cache-shot npx tsx tools/populate-cache.mts --connector mock --dir .cache-shot
 *   CACHE_DIR=.cache-shot AUTH_PEPPER=x SEED_DEMO_CREDENTIALS=1 npx next start apps/shell --port 4310
 *   npx tsx tools/capture-f6.mts capturas
 */
import { mkdirSync } from 'node:fs';
import { chromium, type Page } from '@playwright/test';
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

/** Se entra por la puerta, con contrasena y segundo factor, como cualquiera. */
async function entrar(userId: string): Promise<void> {
  const r = await pagina.request.post(`${base}/api/sign-in`, {
    data: { mail: mailUser(userId), clave: DEMO_KEY, code: totpCodeOf(SECRETO_TOTP_DEMO) },
  });
  if (!r.ok()) throw new Error(`no se pudo entrar como ${userId}: ${r.status()} ${await r.text()}`);
}

let n = 0;
const nombre = (label: string) => `${String(++n).padStart(2, '0')}-${label}`;

/** La pagina entera. El raton se aparta para no dejar un `:hover` accidental encima. */
async function foto(label: string): Promise<void> {
  await pagina.waitForLoadState('networkidle');
  await pagina.mouse.move(1200, 900);
  await pagina.waitForTimeout(250);
  await pagina.screenshot({ path: `${salida}/${nombre(label)}.png`, fullPage: true });
}

/** Un trozo concreto, para lo que no se ve en una captura de 1440 de ancho. */
async function trozo(selector: string, label: string, margen = 24): Promise<void> {
  await pagina.waitForTimeout(250);
  const caja = await pagina.locator(selector).first().boundingBox();
  if (!caja) throw new Error(`no se encontro ${selector} para ${label}`);
  await pagina.screenshot({
    path: `${salida}/${nombre(label)}.png`,
    clip: {
      x: Math.max(0, caja.x - margen),
      y: Math.max(0, caja.y - margen),
      width: caja.width + margen * 2,
      height: caja.height + margen * 2,
    },
  });
}

/* ── F5.53 — el salto al detalle ───────────────────────────────────────────────────────────── */

await entrar('u-ana');
await pagina.goto(`${base}/m/casos-pendientes`);
await foto('f553-modulo-con-salto');

/*
 * El icono del salto, recortado a su tarjeta.
 *
 * «Pendientes por distrito» declara dos destinos y a Ana solo se le ofrece uno —el otro vive fuera
 * de lo que su equipo alcanza—, asi que lo que se ve es el enlace directo y no un menu.
 */
await trozo('.objeto:has([data-testid="drill-Pendientes por distrito"])', 'f553-icono-del-salto');

// Y con un filtro puesto, para que se vea que el salto se lo lleva.
await pagina.goto(`${base}/m/casos-pendientes?DimTribunal.Materia=Penal`);
await pagina.locator('[data-testid="drill-Pendientes por distrito"]').hover();
await trozo('.objeto:has([data-testid="drill-Pendientes por distrito"])', 'f553-salto-con-filtro');

// A donde lleva: el destino, ya filtrado por lo que se estaba mirando.
await pagina.locator('[data-testid="drill-Pendientes por distrito"]').click();
await foto('f553-destino-del-salto');

/* ── F6.8 — el tooltip pegado a su icono ───────────────────────────────────────────────────── */

await pagina.goto(`${base}/m/casos-pendientes`);
await pagina.waitForLoadState('networkidle');
await pagina.locator('[data-testid="icon-tooltip-Pendientes por distrito"]').hover();
await pagina.waitForTimeout(400);
/*
 * Recortado a la tarjeta MAS lo que tiene encima: el globo sale por arriba, asi que un recorte
 * ajustado a la tarjeta lo dejaria justo fuera — que es precisamente lo que hay que ver.
 */
await trozo('.objeto:has([data-testid="icon-tooltip-Pendientes por distrito"])', 'f68-tooltip-pegado', 180);

/* ── F6.5 — codigos de incrustacion ────────────────────────────────────────────────────────── */

await pagina.goto(`${base}/m/casos-pendientes?DimTribunal.Materia=Penal`);
await pagina.waitForLoadState('networkidle');
await pagina.locator('[data-testid="incrustar"]').click();
await pagina.waitForTimeout(600);
await trozo('[data-testid="dialogo-incrustar"]', 'f65-dialogo-de-incrustacion');

// El registro: quien genero cada codigo y para que vista.
await entrar('u-admin');
await pagina.goto(`${base}/admin/embeds`);
await foto('f65-registro-de-codigos');

/*
 * Un codigo suprimido, para ensenar las dos cosas que lo distinguen de un 404: la fila dice
 * «Suprimido» con su motivo, y la URL sigue respondiendo.
 */
const filas = pagina.locator('[data-testid^="revocar-"]:not([data-testid*="motivo"]):not([data-testid*="confirmar"])');
if ((await filas.count()) > 0) {
  const code = ((await filas.first().getAttribute('data-testid')) ?? '').replace('revocar-', '');
  await filas.first().click();
  await pagina.locator(`[data-testid="revocar-motivo-${code}"]`).fill('La cifra estaba mal calculada.');
  await pagina.locator(`[data-testid="revocar-confirmar-${code}"]`).click();
  await pagina.waitForLoadState('networkidle');
  await foto('f65-codigo-suprimido');

  await pagina.goto(`${base}/embed/${code}`);
  await foto('f65-vinculo-suprimido-no-es-404');
}

/* ── F6.6 — el formato de salida de un recurso ─────────────────────────────────────────────── */

await pagina.goto(`${base}/admin/resources/defaults/barras`);
await pagina.waitForLoadState('networkidle');
// Abierta la seccion donde esta la leyenda, que es lo que se va a fijar.
await pagina.locator('[data-testid="pres-barras-grafico"] summary').click();
await pagina.locator('[data-testid="pres-barras-leyenda"]').selectOption('abajo');
await foto('f66-formato-de-salida-de-barras');

await pagina.locator('[data-testid="predeterminar-guardar"]').click();
await pagina.waitForTimeout(600);

// La tabla lo dice: un objeto con formato propio se distingue de uno de fabrica.
await pagina.goto(`${base}/admin/resources/visualizations`);
await foto('f66-recursos-con-formato-propio');
await trozo('[data-testid="recurso-barras"]', 'f66-fila-del-recurso');

/* ── F6.7 — las paginas del editor ─────────────────────────────────────────────────────────── */

/** Un borrador de dos paginas, que es lo que el editor no podia recorrer. */
async function dosPaginas(page: Page, slug: string): Promise<void> {
  const creado = await page.request.post(`${base}/api/modules`, {
    data: { nombre: 'Demora por distrito', slug },
  });
  if (!creado.ok()) return; // Ya existe de una ejecucion anterior.
  const { modulo } = (await creado.json()) as { modulo: { pages: { pageId: string }[] } };

  const tarjeta = (id: string, title: string, measure: string) => ({
    id,
    position: { x: 0, y: 0, w: 4, h: 2 },
    instance: {
      instanceId: id,
      objectId: 'tarjeta-kpi',
      version: '1.0.0',
      title,
      binding: {
        datasetId: 'casos-por-distrito-trimestre',
        dimensions: [],
        measures: [measure],
      },
    },
  });

  await page.request.put(`${base}/api/modules/${slug}/edit`, {
    data: {
      paginas: [
        {
          ...modulo.pages[0],
          slug: 'general',
          name: 'Resumen',
          items: [tarjeta('kpi-pendientes', 'Pendientes', 'CasosPendientes')],
        },
        {
          pageId: 'p-detalle',
          slug: 'detalle',
          name: 'Detalle',
          items: [tarjeta('kpi-ingresados', 'Ingresados', 'CasosIngresados')],
        },
      ],
    },
  });
}

const slug = 'demora-por-distrito';
await dosPaginas(pagina, slug);

await pagina.goto(`${base}/editor/${slug}`);
await foto('f67-editor-primera-pagina');
await trozo('[data-testid="paginas-editor"]', 'f67-barra-de-paginas');

await pagina.locator('[data-testid="pagina-detalle"]').click();
await pagina.waitForTimeout(800);
await foto('f67-editor-segunda-pagina');

// Los saltos se declaran desde el panel, en «Datos»: es la otra mitad de F5.53.
await pagina.locator('[data-testid="select-kpi-ingresados"]').click();
await pagina.waitForTimeout(400);
await pagina.locator('[data-testid^="section-drill-"] summary').click();
await pagina.waitForTimeout(300);
await trozo('[data-testid^="section-drill-"]', 'f553-declarar-un-salto');

await navegador.close();
console.log(`${n} capturas en ${salida}/`);
