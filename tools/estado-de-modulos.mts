/** Valida cada modulo POR SEPARADO y emite el resultado — seccion 3.4. */
import { writeFileSync } from 'node:fs';
import { type HealthSummary, type ModuleHealth, healthOf } from '@app/module-model';
import { definitionDiagnose } from '../apps/shell/src/server/data';
import { modules } from '../apps/shell/src/server/moduleStore';

interface EstadoDeModulo extends HealthSummary {
  slug: string;
  moduleId: string;
}

const destino = process.argv[2] ?? 'estado-de-modulos.json';

const lista = await modules.list();
const states: EstadoDeModulo[] = [];

for (const modulo of lista) {
  try {
    // La clasificacion vive en `module-model`, no aqui: es una afirmacion sobre el dominio —
    // cuando un modulo se puede servir— y el panel de administracion la necesita igual.
    const resumen = healthOf(await definitionDiagnose(modulo));
    states.push({ slug: modulo.slug, moduleId: modulo.moduleId, ...resumen });
  } catch (error) {
    /*
     * Que un modulo reviente al validarse tampoco tumba a los demas.
     */
    states.push({
      slug: modulo.slug,
      moduleId: modulo.moduleId,
      health: 'fallo',
      problems: [error instanceof Error ? error.message : String(error)],
      objetos: { total: 0, rotos: 0 },
    });
  }
}

const informe = { generadoEn: new Date().toISOString(), modules: states };
writeFileSync(destino, `${JSON.stringify(informe, null, 2)}\n`);

const MARCA: Record<ModuleHealth, string> = { ok: '✓', degradado: '~', fallo: '✗' };
for (const e of states) {
  console.log(`${MARCA[e.health]} ${e.slug}${e.problems.length ? ` — ${e.problems.join(' · ')}` : ''}`);
}

const caidos = states.filter((e) => e.health === 'fallo');
const degradados = states.filter((e) => e.health === 'degradado');
console.log(
  `\n${states.length - caidos.length - degradados.length} sanos · ${degradados.length} degradados · ` +
    `${caidos.length} caidos · informe en ${destino}`,
);
if (degradados.length > 0) {
  console.log(`Se despliegan con sus objetos marcados (4.2): ${degradados.map((d) => d.slug).join(', ')}`);
}
if (caidos.length > 0) {
  console.log(`Quedan APAGADOS en App Configuration: ${caidos.map((c) => c.slug).join(', ')}`);
}
