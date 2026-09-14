/** Captura de pantalla del shell en ejecucion, para revision visual. */
import { chromium } from '@playwright/test';

const base = process.env.BASE_URL ?? 'http://localhost:4320';
const salida = process.argv[2] ?? 'captura';

const navegador = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const pagina = await navegador.newPage({ viewport: { width: 1440, height: 1100 } });

await pagina.goto(`${base}/m/casos-pendientes`);
await pagina.waitForLoadState('networkidle');
await pagina.screenshot({ path: `${salida}-modulo.png`, fullPage: true });

await pagina.goto(`${base}/m/casos-pendientes?DimTribunal.Materia=Penal`);
await pagina.waitForLoadState('networkidle');
await pagina.screenshot({ path: `${salida}-filtrado.png`, fullPage: true });

await pagina.goto(`${base}/m/estadisticas`);
await pagina.waitForLoadState('networkidle');
await pagina.screenshot({ path: `${salida}-roto.png`, fullPage: true });

await pagina.setViewportSize({ width: 420, height: 900 });
await pagina.goto(`${base}/m/casos-pendientes`);
await pagina.waitForLoadState('networkidle');
await pagina.screenshot({ path: `${salida}-movil.png`, fullPage: true });

await navegador.close();
console.log('capturas listas');
