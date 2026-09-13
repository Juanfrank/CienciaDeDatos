import { SelectorDeEquipo } from './SelectorDeEquipo';

/** El panel lateral de los modulos. */

export const ID_LATERAL = 'navegacion-lateral';

export function NavegacionPlegable({
  equipos,
  equipoActivo,
  children,
}: {
  equipos: { id: string; name: string; role: string }[];
  equipoActivo: string;
  children: React.ReactNode;
}) {
  return (
    <aside className="lateral" id={ID_LATERAL}>
      <div className="lateral__contenido">{children}</div>

      {/*
        El equipo activo, al pie.

        Estaba en la cabecera, que es donde primero se mira y donde menos falta hace: no se cambia
        de equipo varias veces por sesion, y ocupaba el ancho de un desplegable entero junto a
        cosas que se pulsan a diario. Al pie del panel esta donde esta lo que define el contexto
        —el arbol de arriba es SU arbol—, y sigue a la vista en todo momento, que es lo que pide
        4.10.2.
      */}
      <div className="lateral__pie">
        <SelectorDeEquipo equipos={equipos} equipoActivo={equipoActivo} />
      </div>
    </aside>
  );
}
