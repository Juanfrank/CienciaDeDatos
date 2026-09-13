import type { OrdenDeCategorias } from '../presentacion/contrato';
import type { CategoricalViewModel } from '../registry/viewModel';

/** Ordena las categorias del eje. */
export function ordenarCategorias(
  vm: CategoricalViewModel,
  orden: OrdenDeCategorias | undefined,
): CategoricalViewModel {
  if (!orden?.por) return vm;

  const descendente = orden.direccion === 'desc';
  const signo = descendente ? -1 : 1;

  const points = [...vm.points].sort((a, b) => {
    if (orden.por === 'valor') {
      // `?? null` porque el indice puede no existir: una serie sin valor en este punto es un
      // hueco igual que un `null` explicito, y debe ir al final por la misma razon.
      const va = a.values[0] ?? null;
      const vb = b.values[0] ?? null;
      /*
       * Los huecos van SIEMPRE al final, se ordene como se ordene.
       */
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      return (va - vb) * signo;
    }
    return a.label.localeCompare(b.label, 'es') * signo;
  });

  return { ...vm, points };
}
