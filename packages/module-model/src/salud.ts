import type { ModuleDiagnostics } from './validation';

/** La salud de un modulo, en tres estados — seccion 3.4. */
export type SaludDeModulo = 'ok' | 'degradado' | 'fallo';

export interface ResumenDeSalud {
  salud: SaludDeModulo;
  objetos: { total: number; rotos: number };
  /** Motivos, ya legibles. Los de disposicion primero: son los que tumban el modulo. */
  problemas: string[];
}

/** Que hace que un modulo NO se pueda componer: */
export function saludDe(diagnostico: ModuleDiagnostics): ResumenDeSalud {
  const rotos = diagnostico.items.filter((i) => i.broken);
  const total = diagnostico.items.length;

  const disposicion = diagnostico.layoutProblems.map((p) => p.problem);
  const deObjetos = rotos.map(
    (i) => `${i.objectId}: ${i.unresolvedObject ?? i.bindingProblems.map((p) => p.problem).join(' ')}`,
  );

  const salud: SaludDeModulo =
    disposicion.length > 0 || total === 0 || rotos.length === total
      ? 'fallo'
      : rotos.length > 0
        ? 'degradado'
        : 'ok';

  return { salud, objetos: { total, rotos: rotos.length }, problemas: [...disposicion, ...deObjetos] };
}
