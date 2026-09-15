/** Capturas de F5.54: filtros Basico/Avanzado y los dos navegadores colapsables. */
import { chromium } from '@playwright/test';
import {
  DEMO_KEY,
  SECRETO_TOTP_DEMO,
  mailUser,
  totpCodeOf,
} from '../apps/shell/src/server/demoCredentials';

const base = process.env.BASE_URL ?? 'http://localhost:4310';
const dir = 'capturas';

const navegador = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await navegador.newContext({ viewport: { width: 1440, height: 950 } });
const p = await ctx.newPage();

// Sesion, por la misma puerta que las pruebas
const login = await p.request.post(`${base}/api/sign-in`, {
  data: { mail: mailUser('u-ana'), clave: DEMO_KEY, code: totpCodeOf(SECRETO_TOTP_DEMO) },
});
if (!login.ok()) throw new Error(`no se pudo entrar: ${login.status()} ${await login.text()}`);

const tirar = async (nombre: string) => {
  await p.waitForLoadState('networkidle');
  await p.screenshot({ path: `${dir}/${nombre}.png` });
  console.log(nombre);
};

// 1. Filtros en BASICO (por defecto)
await p.goto(`${base}/m/casos-pendientes`);
await tirar('59-filtros-basico');

// 2. Filtros en AVANZADO
await p.getByTestId('filter-DimTribunal.Materia-avanzado').click();
await p.waitForTimeout(250);
await tirar('60-filtros-avanzado');

// 3. Navegador de modulos desplegado (superpuesto)
await p.goto(`${base}/m/composicion`);
await tirar('61-modulos-desplegado');

// 4. Navegador de modulos COLAPSADO a carril
await p.getByTestId('lateral-plegar').click();
await p.waitForTimeout(300);
await tirar('62-modulos-carril');

// 5. Los dos colapsados a la vez: el contenido empieza pasados los dos carriles
await p.getByTestId('navegador-plegar').click();
await p.waitForTimeout(300);
await tirar('63-dos-carriles');

await navegador.close();
console.log('listo');
