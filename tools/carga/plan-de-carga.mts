/** Prueba de carga del camino de lectura — secciones 5.5 y 8.3. */

interface Escenario {
  nombre: string;
  ruta: string;
  /** Peso relativo: cuantas veces aparece por vuelta. */
  peso: number;
}

/** Perfil de uso. */
export const ESCENARIOS: Escenario[] = [
  { nombre: 'modulo completo', ruta: '/api/modulos/casos-pendientes', peso: 4 },
  {
    nombre: 'modulo filtrado',
    ruta: '/api/modulos/casos-pendientes?DimTribunal.Materia=Penal',
    peso: 6,
  },
  { nombre: 'navegacion', ruta: '/api/navegacion', peso: 2 },
  { nombre: 'salud', ruta: '/health', peso: 1 },
];

interface Medicion {
  ok: number;
  fallos: number;
  latenciasMs: number[];
}

const percentil = (valores: number[], p: number): number => {
  if (valores.length === 0) return 0;
  const ordenadas = [...valores].sort((a, b) => a - b);
  return ordenadas[Math.min(ordenadas.length - 1, Math.floor((p / 100) * ordenadas.length))] ?? 0;
};

async function trabajador(base: string, hasta: number, cookie: string, medicion: Medicion) {
  const rutas = ESCENARIOS.flatMap((e) => Array.from({ length: e.peso }, () => e.ruta));

  while (Date.now() < hasta) {
    const ruta = rutas[Math.floor(Math.random() * rutas.length)] ?? rutas[0] ?? '/health';
    const inicio = performance.now();
    try {
      const r = await fetch(`${base}${ruta}`, { headers: { cookie } });
      medicion.latenciasMs.push(performance.now() - inicio);
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
  const leer = (bandera: string, pordefecto: string): string => {
    const i = args.indexOf(bandera);
    return i >= 0 ? (args[i + 1] ?? pordefecto) : pordefecto;
  };

  const base = leer('--url', 'http://localhost:4310').replace(/\/$/, '');
  const concurrencia = Number(leer('--concurrencia', '20'));
  const segundos = Number(leer('--segundos', '20'));

  // Una sesion real: sin ella cada peticion emitiria una nueva y se mediria el alta de sesion,
  // no la lectura.
  const alta = await fetch(`${base}/api/sesion/equipo-activo`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: 'u-ana' }),
  });
  const cookie = (alta.headers.get('set-cookie') ?? '').split(';')[0] ?? '';

  const antes = await (await fetch(`${base}/health`, { headers: { cookie } })).json();

  const medicion: Medicion = { ok: 0, fallos: 0, latenciasMs: [] };
  const hasta = Date.now() + segundos * 1000;
  await Promise.all(
    Array.from({ length: concurrencia }, () => trabajador(base, hasta, cookie, medicion)),
  );

  const despues = await (await fetch(`${base}/health`, { headers: { cookie } })).json();
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
  console.log(`  lecturas:      ${despues.cache.total - antes.cache.total}`);
  console.log(`  desde L1:      ${despues.cache.desdeL1 - antes.cache.desdeL1}`);
  console.log(`  desde L2:      ${despues.cache.desdeL2 - antes.cache.desdeL2}`);
  console.log(`  sin poblar:    ${despues.cache.generandose - antes.cache.generandose}`);
  console.log(`  degradadas:    ${despues.cache.degradados - antes.cache.degradados}`);
  console.log('');
  console.log('Recordatorio: estos numeros NO fijan umbrales de autoscale. Ver');
  console.log('docs/operacion/prueba-de-carga.md.');

  // Un fallo bajo carga es un resultado, no un detalle: se refleja en el codigo de salida.
  if (medicion.fallos > 0) process.exitCode = 1;
}

await principal();
