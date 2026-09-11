import {
  GRID_COLUMNS,
  layoutsForAllBreakpoints,
  readingOrder,
  rowSpanForBreakpoint,
  type Breakpoint,
} from '@app/module-model';

/**
 * Rejilla responsiva — seccion 4.2, con la parte movil de 4.9.
 *
 * La disposicion guardada es SIEMPRE la de doce columnas; las de tableta y movil se derivan de
 * ella, asi que hay una sola disposicion que mantener.
 *
 * Las tres se emiten a la vez como variables CSS y la eleccion la hace una media query. Antes se
 * medía el ancho de la ventana al montar, y eso pintaba primero la disposicion de escritorio
 * —en un movil, un salto visible— y dejaba la pagina mal dispuesta si el JavaScript no llegaba a
 * ejecutarse. Con variables y media queries el primer pintado ya es el correcto, no hace falta
 * escuchar `resize`, y este componente deja de necesitar estado.
 *
 * Los objetos se emiten en ORDEN DE LECTURA de la disposicion guardada. Es lo que hace que la
 * colocacion automatica de CSS Grid reproduzca las tres disposiciones desde un mismo DOM, y
 * ademas es el orden en el que los recorre quien navega con teclado o lector de pantalla.
 */

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
          <div key={item.id} className="rejilla__celda" style={variables as React.CSSProperties}>
            {children(item.id)}
          </div>
        );
      })}
    </div>
  );
}
