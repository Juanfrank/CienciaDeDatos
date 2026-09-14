/**
 * Capturas del panel de administracion, para revision visual.
 *
 * Estaba rota de tres formas distintas, y ninguna se notaba porque un script de capturas solo
 * falla cuando alguien lo ejecuta: apuntaba a `/admin/arbol` y `/admin/sees-who-where`, que
 * dejaron de existir con el renombrado al ingles, y entraba llamando a
 * `/api/session/active-team` con un `userId`, que es justo lo que la seccion 4.7 cerro —cambiar
 * de persona sin autenticar—. Ahora entra por la puerta, y las rutas las comprueba
 * `tools/coherence/rutas.spec.ts`, que ya mira tambien lo que hay bajo `tools/`.
 *
 *   npx nx run shell:build
 *   CACHE_DIR=.cache-shot npx tsx tools/populate-cache.mts --connector mock --dir .cache-shot
 *   CACHE_DIR=.cache-shot AUTH_PEPPER=x SEED_DEMO_CREDENTIALS=1 npx next start apps/shell --port 4310
 *   npx tsx tools/capture-admin.mts capturas
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

/** Cada seccion del panel, en el orden del carril. */
const SECCIONES: readonly (readonly [string, string])[] = [
  ['/admin', '01-panel-inicio'],
  ['/admin/modules', '02-modulos'],
  ['/admin/modules/pending', '03-modulos-propuestas'],
  ['/admin/modules/tree', '04-modulos-organizacion'],
  ['/admin/modules/packages', '05-modulos-paquetes'],
  ['/admin/resources', '06-recursos'],
  ['/admin/resources/visualizations', '07-recursos-visualizaciones'],
  ['/admin/resources/elements', '08-recursos-elementos'],
  ['/admin/resources/containers', '09-recursos-contenedores'],
  ['/admin/resources/addons', '10-recursos-complementos'],
  ['/admin/resources/other', '11-recursos-otros'],
  ['/admin/users', '12-usuarios'],
  ['/admin/users/permissions', '13-usuarios-permisos'],
  ['/admin/teams', '14-equipos'],
  ['/admin/accounts', '15-cuentas'],
  ['/admin/scopes', '16-ambitos'],
  ['/admin/who-sees-what', '17-quien-ve-que'],
  ['/admin/audit', '18-auditoria'],
  ['/admin/themes', '19-temas'],
  ['/admin/sources', '20-origenes'],
];

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

/*
 * Una propuesta de verdad, para que la cola de revision no salga vacia.
 *
 * Una captura de la pantalla vacia no ensena la pantalla: lo que hay que poder ver es quien
 * propuso, que cambia y los dos botones. Se publica una version primero para que la propuesta
 * tenga con que compararse — sin eso el resumen dice «es la primera publicacion» y tampoco
 * ensena nada.
 */
async function sembrarPropuesta(): Promise<void> {
  const slug = 'demora-por-materia';
  await entrar('u-ana');

  const creado = await pagina.request.post(`${base}/api/modules`, {
    data: { nombre: 'Demora por materia', slug },
  });
  if (!creado.ok()) return; // Ya existe de una ejecucion anterior: no se vuelve a sembrar.
  const { modulo } = (await creado.json()) as { modulo: { pages: { pageId: string }[] } };

  const kpi = (id: string, title: string, x: number) => ({
    id,
    position: { x, y: 0, w: 3, h: 2 },
    instance: {
      instanceId: id,
      objectId: 'tarjeta-kpi',
      version: '1.0.0',
      title,
      binding: {
        datasetId: 'casos-por-distrito-trimestre',
        dimensions: [],
        measures: ['CasosPendientes'],
      },
    },
  });

  await pagina.request.put(`${base}/api/modules/${slug}/edit`, {
    data: {
      paginas: [
        { ...modulo.pages[0], slug: 'general', name: 'General', items: [kpi('kpi', 'Pendientes', 0)] },
      ],
    },
  });
  await pagina.request.post(`${base}/api/modules/${slug}/status`, { data: { transition: 'enviar' } });

  await entrar('u-admin');
  await pagina.request.post(`${base}/api/modules/${slug}/status`, { data: { transition: 'publicar' } });
  await pagina.request.post(`${base}/api/modules/${slug}/status`, {
    data: { transition: 'devolver', motivo: 'falta la comparacion con el trimestre anterior' },
  });

  const actual = (await (await pagina.request.get(`${base}/api/modules/${slug}/edit`)).json()) as {
    modulo: { pages: { items: { instance: { title: string } }[] }[] };
  };
  const p0 = actual.modulo.pages[0];
  if (!p0) return;
  const primero = p0.items[0];
  if (!primero) return;

  await pagina.request.put(`${base}/api/modules/${slug}/edit`, {
    data: {
      paginas: [
        {
          ...p0,
          items: [
            { ...primero, instance: { ...primero.instance, title: 'Casos pendientes' } },
            kpi('kpi-resueltos', 'Resueltos en el trimestre', 3),
          ],
        },
      ],
    },
  });
  await pagina.request.post(`${base}/api/modules/${slug}/status`, { data: { transition: 'enviar' } });
}

await sembrarPropuesta();
await entrar('u-admin');

// El desplegable de la cuenta, abierto: es donde vive todo lo que no es mirar datos.
await pagina.goto(`${base}/`);
await pagina.getByTestId('account-trigger').click();
await pagina.waitForTimeout(400);
await pagina.screenshot({ path: `${salida}/00-menu-de-cuenta.png` });

for (const [path, label] of SECCIONES) {
  await pagina.goto(`${base}${path}`);
  await pagina.waitForLoadState('networkidle');
  // El puntero aparcado sobre el cromo deja abierto lo que toque, y se cuela en la foto siguiente.
  await pagina.mouse.move(700, 600);
  await pagina.waitForTimeout(250);
  await pagina.screenshot({ path: `${salida}/${label}.png`, fullPage: true });
}

/*
 * El uso de un recurso vive en `/admin/resources/usage/[id]`, que lleva un parametro y por eso no
 * cabe en la lista fija de arriba. Se llega como llega una persona: pinchando la columna «En uso».
 */
await pagina.goto(`${base}/admin/resources/visualizations`);
await pagina.waitForLoadState('networkidle');
await pagina.locator('a[href^="/admin/resources/usage/"]').first().click();
await pagina.waitForLoadState('networkidle');
await pagina.mouse.move(700, 600);
await pagina.waitForTimeout(250);
await pagina.screenshot({ path: `${salida}/21-recursos-uso.png`, fullPage: true });

await navegador.close();
console.log(`${SECCIONES.length + 2} capturas en ${salida}/`);
