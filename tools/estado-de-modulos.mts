/** Valida cada modulo POR SEPARADO y emite el resultado — seccion 3.4. */
import { writeFileSync } from 'node:fs';
import { type ResumenDeSalud, type SaludDeModulo, saludDe } from '@app/module-model';
import { diagnosticarDefinicion } from '../apps/shell/src/server/datos';
import { modulos } from '../apps/shell/src/server/almacenModulos';

interface EstadoDeModulo extends ResumenDeSalud {
  slug: string;
  moduleId: string;
}

const destino = process.argv[2] ?? 'estado-de-modulos.json';

const lista = await modulos.list();
const estados: EstadoDeModulo[] = [];

for (const modulo of lista) {
  try {
    // La clasificacion vive en `module-model`, no aqui: es una afirmacion sobre el dominio —
    // cuando un modulo se puede servir— y el panel de administracion la necesita igual.
    const resumen = saludDe(await diagnosticarDefinicion(modulo));
    estados.push({ slug: modulo.slug, moduleId: modulo.moduleId, ...resumen });
  } catch (error) {
    /*
     * Que un modulo reviente al validarse tampoco tumba a los demas.
     */
    estados.push({
      slug: modulo.slug,
      moduleId: modulo.moduleId,
      salud: 'fallo',
      problems: [error instanceof Error ? error.message : String(error)],
      objetos: { total: 0, rotos: 0 },
    });
  }
}

const informe = { generadoEn: new Date().toISOString(), modulos: estados };
writeFileSync(destino, `${JSON.stringify(informe, null, 2)}\n`);

const MARCA: Record<SaludDeModulo, string> = { ok: '✓', degradado: '~', fallo: '✗' };
for (const e of estados) {
  console.log(`${MARCA[e.salud]} ${e.slug}${e.problems.length ? ` — ${e.problems.join(' · ')}` : ''}`);
}

const caidos = estados.filter((e) => e.salud === 'fallo');
const degradados = estados.filter((e) => e.salud === 'degradado');
console.log(
  `\n${estados.length - caidos.length - degradados.length} sanos · ${degradados.length} degradados · ` +
    `${caidos.length} caidos · informe en ${destino}`,
);
if (degradados.length > 0) {
  console.log(`Se despliegan con sus objetos marcados (4.2): ${degradados.map((d) => d.slug).join(', ')}`);
}
if (caidos.length > 0) {
  console.log(`Quedan APAGADOS en App Configuration: ${caidos.map((c) => c.slug).join(', ')}`);
}
