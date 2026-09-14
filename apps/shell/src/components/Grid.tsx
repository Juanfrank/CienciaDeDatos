import {
  GRID_COLUMNS,
  layoutsForAllBreakpoints,
  readingOrder,
  rowSpanForBreakpoint,
  type Breakpoint,
} from '@app/module-model';

/** Rejilla responsiva — seccion 4.2, con la parte movil de 4.9. */

const TAMANOS: Breakpoint[] = ['escritorio', 'tableta', 'movil'];

export function Grid({
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
          const cellPosition = disposiciones[tamano].get(item.id) ?? item.position;
          const alto = rowSpanForBreakpoint(cellPosition.h, tamano);
          variables[`--col-${tamano}`] = `${cellPosition.x + 1} / span ${cellPosition.w}`;
          /*
           * El DOBLE de pistas, porque la pista es media fila.
           *
           * La rejilla se partio por la mitad para que el contenedor expandible cerrado pueda
           * ocupar media, que es lo que es un chiclet. Todo lo demas sigue midiendo lo mismo
           * porque ocupa dos pistas por cada fila que tenia — y `auto` sigue siendo `auto`: en
           * una sola columna el alto guardado solo produce cajas altas y medio vacias.
           */
          variables[`--fila-${tamano}`] = alto === null ? 'auto' : `span ${alto * 2}`;
        }

        return (
          <div
            key={item.id}
            className="grid__cell"
            // Identifica la celda por el id del objeto que contiene. Lo necesita cualquier
            // prueba que hable de UN objeto concreto —que este o que no este—, y sin el habria
            // que localizarlos por su texto, que cambia en cuanto alguien renombra un titulo.
            data-testid={`cell-${item.id}`}
            style={variables as React.CSSProperties}
          >
            {children(item.id)}
          </div>
        );
      })}
    </div>
  );
}
