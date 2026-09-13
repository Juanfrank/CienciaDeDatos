import type { ModuleDiagnostics } from './validation';

/** La salud de un modulo, en tres estados — seccion 3.4. */
export type ModuleHealth = 'ok' | 'degradado' | 'fallo';

export interface HealthSummary {
  health: ModuleHealth;
  objetos: { total: number; rotos: number };
  /** Motivos, ya legibles. Los de disposicion primero: son los que tumban el modulo. */
  problems: string[];
}

/** Que hace que un modulo NO se pueda componer: */
export function healthOf(diagnostico: ModuleDiagnostics): HealthSummary {
  const rotos = diagnostico.items.filter((i) => i.broken);
  const total = diagnostico.items.length;

  const disposicion = diagnostico.layoutProblems.map((p) => p.problem);
  const objects = rotos.map(
    (i) => `${i.objectId}: ${i.unresolvedObject ?? i.bindingProblems.map((p) => p.problem).join(' ')}`,
  );

  const health: ModuleHealth =
    disposicion.length > 0 || total === 0 || rotos.length === total
      ? 'fallo'
      : rotos.length > 0
        ? 'degradado'
        : 'ok';

  return { health, objetos: { total, rotos: rotos.length }, problems: [...disposicion, ...objects] };
}
