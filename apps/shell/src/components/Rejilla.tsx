import {
  GRID_COLUMNS,
  layoutsForAllBreakpoints,
  readingOrder,
  rowSpanForBreakpoint,
  type Breakpoint,
} from '@app/module-model';

/** Rejilla responsiva — seccion 4.2, con la parte movil de 4.9. */

const TAMANOS: Breakpoint[] = ['escritorio', 'tableta', 'movil'];

export function Rejilla({
  items,
  children,
}: {
  items: { id: string; position: { x: number; y: number; w: number; h: number } }[];
  children: (id: string) => React.ReactNode;
}) {
  const disposiciones = layoutsForAllBreakpoints(items);

  return (
    <div className="rejilla" style={{ '--rejilla-columnas': GRID_COLUMNS } as React.CSSProperties}>
      {readingOrder(items).map((item) => {
        const variables: Record<string, string> = {};

        for (const tamano of TAMANOS) {
          const posicion = disposiciones[tamano].get(item.id) ?? item.position;
          const alto = rowSpanForBreakpoint(posicion.h, tamano);
          variables[`--col-${tamano}`] = `${posicion.x + 1} / span ${posicion.w}`;
          // `auto` deja que el contenido marque el alto: en una sola columna el alto guardado
          // solo produce cajas altas y medio vacias.
          variables[`--fila-${tamano}`] = alto === null ? 'auto' : `span ${alto}`;
        }

        return (
          <div
            key={item.id}
            className="rejilla__celda"
            // Identifica la celda por el id del objeto que contiene. Lo necesita cualquier
            // prueba que hable de UN objeto concreto —que este o que no este—, y sin el habria
            // que localizarlos por su texto, que cambia en cuanto alguien renombra un titulo.
            data-testid={`celda-${item.id}`}
            style={variables as React.CSSProperties}
          >
            {children(item.id)}
          </div>
        );
      })}
    </div>
  );
}
