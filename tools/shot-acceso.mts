/** Captura de la pantalla de acceso. */
import { chromium } from '@playwright/test';
const base = process.env.BASE_URL ?? 'http://localhost:4310';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
for (const [nombre, ancho, alto] of [
  ['69-acceso', 1280, 900],
  ['70-acceso-movil', 390, 844],
] as const) {
  const ctx = await nav.newContext({ viewport: { width: ancho, height: alto } });
  const p = await ctx.newPage();
  await p.goto(`${base}/sign-in`);
  await p.waitForLoadState('networkidle');
  await p.screenshot({ path: `capturas/${nombre}.png`, fullPage: true });
  console.log(nombre);
}
await nav.close();
