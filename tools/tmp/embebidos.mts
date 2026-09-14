import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';
import {
  DEMO_KEY,
  SECRETO_TOTP_DEMO,
  mailUser,
  totpCodeOf,
} from '../../apps/shell/src/server/demoCredentials';

const base = 'http://localhost:4310';
const salida = process.argv[2] ?? 'capturas';
mkdirSync(salida, { recursive: true });

const navegador = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--disable-dev-shm-usage'],
});
const pagina = await (
  await navegador.newContext({ viewport: { width: 1100, height: 700 } })
).newPage();

const r = await pagina.request.post(`${base}/api/sign-in`, {
  data: { mail: mailUser('u-admin'), clave: DEMO_KEY, code: totpCodeOf(SECRETO_TOTP_DEMO) },
});
if (!r.ok()) throw new Error(`no se pudo entrar: ${r.status()}`);

const CON_FILTROS = {
  tipo: 'panel-izquierdo',
  comportamiento: 'grilla',
  filtros: {
    etiqueta: 'Filtros de busqueda',
    datasetId: 'casos-por-distrito-trimestre',
    pickers: [
      { fieldName: 'DimTiempo.Trimestre', tipo: 'desplegable', etiqueta: 'Trimestre' },
      { fieldName: 'DimTribunal.Materia', tipo: 'pastillas', etiqueta: 'Materia' },
    ],
  },
};
const SIN_FILTROS = { tipo: 'panel-izquierdo', comportamiento: 'grilla' };

const configurar = async (navigator: unknown) => {
  const respuesta = await pagina.request.put(`${base}/api/modules/composicion/settings`, {
    data: {
      settings: {
        name: 'Composicion',
        slug: 'composicion',
        description: '',
        options: {},
        defaultFilters: [],
        navigator,
      },
    },
  });
  if (!respuesta.ok()) throw new Error(`no se pudo configurar: ${await respuesta.text()}`);
};

const foto = async (ruta: string, nombre: string) => {
  await pagina.goto(`${base}${ruta}`);
  await pagina.waitForLoadState('networkidle');
  await pagina.waitForTimeout(400);
  await pagina.screenshot({ path: `${salida}/${nombre}.png`, fullPage: true });
  console.log(nombre);
};

await configurar(CON_FILTROS);
await foto('/embed/m/composicion', '40-embebido-con-encabezado-con-filtros');
await foto('/embed/m/composicion?cromo=limpio', '41-embebido-sin-encabezado-con-filtros');

await configurar(SIN_FILTROS);
await foto('/embed/m/composicion', '42-embebido-con-encabezado-sin-filtros');
await foto('/embed/m/composicion?cromo=limpio', '43-embebido-sin-encabezado-sin-filtros');

await configurar(CON_FILTROS);
await navegador.close();
