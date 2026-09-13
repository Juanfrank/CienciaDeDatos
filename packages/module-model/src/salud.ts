import type { ModuleDiagnostics } from './validation';

/**
 * La salud de un modulo, en tres estados — seccion 3.4.
 *
 * Tres y no dos, porque **un objeto roto no es un modulo caido**. Es literalmente lo que manda
 * 4.2: un objeto cuyo campo desaparecio se MARCA y el resto del modulo sigue funcionando. Tratar
 * eso como «modulo caido» seria incumplir esa regla desde el despliegue — y ademas convertiria el
 * fixture que demuestra ese comportamiento en un modulo permanentemente rojo.
 *
 * Vive aqui y no en el script de CI porque es una afirmacion sobre el dominio —cuando un modulo
 * se puede servir— y porque el script no es el unico que la necesita: el panel de administracion
 * quiere decir lo mismo con las mismas palabras.
 */
export type SaludDeModulo = 'ok' | 'degradado' | 'fallo';

export interface ResumenDeSalud {
  salud: SaludDeModulo;
  objetos: { total: number; rotos: number };
  /** Motivos, ya legibles. Los de disposicion primero: son los que tumban el modulo. */
  problemas: string[];
}

/**
 * Que hace que un modulo NO se pueda componer:
 *
 *   - **Disposicion invalida.** Dos bloques superpuestos o fuera de la rejilla no se pueden
 *     dibujar ni marcar: no hay donde ponerlos.
 *   - **Ningun objeto.** Una pagina en blanco no es un modulo degradado, es un modulo vacio.
 *   - **Todos los objetos rotos.** Si no queda ni uno sano, «se marca y el resto sigue» no
 *     significa nada: no hay resto.
 */
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
