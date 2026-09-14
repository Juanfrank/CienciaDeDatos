/** Capturas del panel de administracion, para revision visual. */
import { chromium } from '@playwright/test';

const base = process.env.BASE_URL ?? 'http://localhost:4310';
const salida = process.argv[2] ?? 'admin';

const navegador = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const pagina = await navegador.newPage({ viewport: { width: 1440, height: 1000 } });

await pagina.goto(`${base}/`);
await pagina.request.post(`${base}/api/sesion/equipo-activo`, { data: { userId: 'u-admin' } });

// Se provoca una ampliacion para que la auditoria tenga algo que destacar.
await pagina.request.post(`${base}/api/admin/ambitos`, {
  data: {
    destino: { tipo: 'equipo', teamId: 'equipo-norte' },
    scope: {
      restrictions: [
        { dimension: { table: 'DimTribunal', field: 'Materia' }, allowedValues: ['Penal', 'Civil', 'Laboral'] },
      ],
    },
    justificacion: 'Auditoria laboral trimestral aprobada por el Consejo',
  },
});

for (const [path, label] of [
  ['/admin', 'inicio'],
  ['/admin/arbol', 'arbol'],
  ['/admin/ambitos', 'ambitos'],
  ['/admin/auditoria', 'auditoria'],
] as const) {
  await pagina.goto(`${base}${path}`);
  await pagina.waitForLoadState('networkidle');
  await pagina.screenshot({ path: `${salida}-${label}.png`, fullPage: true });
}

// "Quien ve que" necesita una consulta antes de tener algo que mostrar.
await pagina.goto(`${base}/admin/sees-who-where`);
await pagina.getByTestId('qvq-consultar').click();
await pagina.waitForTimeout(400);
await pagina.screenshot({ path: `${salida}-sees-who-where.png`, fullPage: true });

await navegador.close();
console.log('capturas listas');
