/** Prueba de carga del camino de lectura — secciones 5.5 y 8.3. */

interface Escenario {
  label: string;
  path: string;
  /** Peso relativo: cuantas veces aparece por vuelta. */
  peso: number;
}

/** Perfil de uso. */
export const ESCENARIOS: Escenario[] = [
  { label: 'modulo completo', path: '/api/modules/casos-pendientes', peso: 4 },
  {
    label: 'modulo filtrado',
    path: '/api/modules/casos-pendientes?DimTribunal.Materia=Penal',
    peso: 6,
  },
  { label: 'navegacion', path: '/api/navigation', peso: 2 },
  { label: 'salud', path: '/health', peso: 1 },
];

interface Medicion {
  ok: number;
  fallos: number;
  latenciasMs: number[];
}

/** Lo que el script lee de `/health`. Solo los contadores de cache, que es lo que compara. */
interface Salud {
  cache: {
    total: number;
    desdeL1: number;
    desdeL2: number;
    generating: number;
    degradados: number;
  };
}

const percentil = (valores: number[], p: number): number => {
  if (valores.length === 0) return 0;
  const ordenadas = [...valores].sort((a, b) => a - b);
  return ordenadas[Math.min(ordenadas.length - 1, Math.floor((p / 100) * ordenadas.length))] ?? 0;
};

async function trabajador(base: string, hasta: number, cookie: string, medicion: Medicion) {
  const rutas = ESCENARIOS.flatMap((e) => Array.from({ length: e.peso }, () => e.path));

  while (Date.now() < hasta) {
    const path = rutas[Math.floor(Math.random() * rutas.length)] ?? rutas[0] ?? '/health';
    const home = performance.now();
    try {
      const r = await fetch(`${base}${path}`, { headers: { cookie } });
      medicion.latenciasMs.push(performance.now() - home);
      if (r.ok) medicion.ok += 1;
      else medicion.fallos += 1;
      await r.arrayBuffer();
    } catch {
      medicion.fallos += 1;
    }
  }
}

async function principal(): Promise<void> {
  const args = process.argv.slice(2);
  const read = (bandera: string, pordefecto: string): string => {
    const i = args.indexOf(bandera);
    return i >= 0 ? (args[i + 1] ?? pordefecto) : pordefecto;
  };

  const base = read('--url', 'http://localhost:4310').replace(/\/$/, '');
  const concurrencia = Number(read('--concurrencia', '20'));
  const segundos = Number(read('--segundos', '20'));

  // Una sesion real: sin ella cada peticion emitiria una nueva y se mediria el alta de sesion,
  // no la lectura.
  const alta = await fetch(`${base}/api/session/active-team`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: 'u-ana' }),
  });
  const cookie = (alta.headers.get('set-cookie') ?? '').split(';')[0] ?? '';

  const before = (await (await fetch(`${base}/health`, { headers: { cookie } })).json()) as Salud;

  const medicion: Medicion = { ok: 0, fallos: 0, latenciasMs: [] };
  const hasta = Date.now() + segundos * 1000;
  await Promise.all(
    Array.from({ length: concurrencia }, () => trabajador(base, hasta, cookie, medicion)),
  );

  const after = (await (await fetch(`${base}/health`, { headers: { cookie } })).json()) as Salud;
  const total = medicion.ok + medicion.fallos;

  console.log('');
  console.log(`URL:             ${base}`);
  console.log(`Concurrencia:    ${concurrencia} durante ${segundos} s`);
  console.log(`Peticiones:      ${total} (${medicion.fallos} fallidas)`);
  console.log(`Rendimiento:     ${(total / segundos).toFixed(1)} peticiones/s`);
  console.log(`Latencia p50:    ${percentil(medicion.latenciasMs, 50).toFixed(0)} ms`);
  console.log(`Latencia p95:    ${percentil(medicion.latenciasMs, 95).toFixed(0)} ms`);
  console.log(`Latencia p99:    ${percentil(medicion.latenciasMs, 99).toFixed(0)} ms`);
  console.log('');
  console.log('Cache durante la prueba (8.3):');
  console.log(`  lecturas:      ${after.cache.total - before.cache.total}`);
  console.log(`  desde L1:      ${after.cache.desdeL1 - before.cache.desdeL1}`);
  console.log(`  desde L2:      ${after.cache.desdeL2 - before.cache.desdeL2}`);
  console.log(`  sin poblar:    ${after.cache.generating - before.cache.generating}`);
  console.log(`  degradadas:    ${after.cache.degradados - before.cache.degradados}`);
  console.log('');
  console.log('Recordatorio: estos numeros NO fijan umbrales de autoscale. Ver');
  console.log('docs/operations/prueba-de-carga.md.');

  // Un fallo bajo carga es un resultado, no un detalle: se refleja en el codigo de salida.
  if (medicion.fallos > 0) process.exitCode = 1;
}

await principal();
