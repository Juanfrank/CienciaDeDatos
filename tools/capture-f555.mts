/** Capturas de F5.55: los dos navegadores como un solo borde. */
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

const login = await p.request.post(`${base}/api/sign-in`, {
  data: { mail: mailUser('u-ana'), clave: DEMO_KEY, code: totpCodeOf(SECRETO_TOTP_DEMO) },
});
if (!login.ok()) throw new Error(`no se pudo entrar: ${login.status()} ${await login.text()}`);

const tirar = async (nombre: string) => {
  await p.waitForLoadState('networkidle');
  await p.screenshot({ path: `${dir}/${nombre}.png` });
  console.log(nombre);
};

// 1. Los dos desplegados: el panel de pagina pegado al de modulos y a los dos bordes.
await p.goto(`${base}/m/composicion`);
await tirar('64-dos-paneles');

// 2. Solo el de paginas en carril: sigue pegado al panel de modulos.
await p.getByTestId('navegador-plegar').click();
await p.waitForTimeout(300);
await tirar('65-paginas-en-carril');

// 3. Los dos en carril: un unico borde de iconos, sin franja de fondo entre medias.
await p.getByTestId('lateral-plegar').click();
await p.waitForTimeout(300);
await tirar('66-un-solo-carril');

/*
 * 4. Con el modulo desplazado: el panel no se va con el contenido.
 *
 * En una ventana baja, que es donde se nota: con 950 de alto esta pagina cabe entera y no hay
 * nada que desplazar, asi que la captura no ensenaria nada.
 */
const baja = await navegador.newContext({ viewport: { width: 1280, height: 720 } });
const b = await baja.newPage();
const otra = await b.request.post(`${base}/api/sign-in`, {
  data: { mail: mailUser('u-ana'), clave: DEMO_KEY, code: totpCodeOf(SECRETO_TOTP_DEMO) },
});
if (!otra.ok()) throw new Error(`no se pudo entrar: ${otra.status()}`);
await b.goto(`${base}/m/composicion`);
await b.waitForLoadState('networkidle');
const cuanto = await b.locator('.modulo').evaluate((n) => {
  n.scrollBy(0, 600);
  return n.scrollTop;
});
if (cuanto === 0) throw new Error('el modulo no se desplazo: la captura no ensenaria nada');
await b.waitForTimeout(300);
await b.screenshot({ path: `${dir}/67-desplazado.png` });
console.log(`67-desplazado (desplazado ${cuanto}px)`);

// 5. Los dos comportamientos que quedan, en la pantalla que los elige. Otra sesion, porque
// configurar un modulo es cosa de quien administra.
const ctxAdmin = await navegador.newContext({ viewport: { width: 1440, height: 950 } });
const a = await ctxAdmin.newPage();
const entra = await a.request.post(`${base}/api/sign-in`, {
  data: { mail: mailUser('u-admin'), clave: DEMO_KEY, code: totpCodeOf(SECRETO_TOTP_DEMO) },
});
if (!entra.ok()) throw new Error(`no se pudo entrar como admin: ${entra.status()}`);
await a.goto(`${base}/admin/modules/composicion/settings`);
await a.waitForLoadState('networkidle');
await a.screenshot({ path: `${dir}/68-dos-comportamientos.png` });
console.log('68-dos-comportamientos');

await navegador.close();
console.log('listo');
