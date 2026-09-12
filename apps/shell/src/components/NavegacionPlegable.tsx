import { SelectorDeEquipo } from './SelectorDeEquipo';

/**
 * El panel lateral de los modulos.
 *
 * Ya no lleva logica: es un `<aside>` que el servidor emite VISIBLE y que el boton de la
 * cabecera pliega escribiendo `data-lateral` en `<body>`. Antes era un `<details>` con su propio
 * estado, y con el boton fuera del panel habia dos fuentes de verdad para lo mismo — el
 * `open` del elemento y lo que el boton creyera—, que es como se acaba con un boton que dice
 * "cerrado" sobre un panel abierto. El estado vive en un solo sitio, y ese sitio es el boton.
 *
 * Emitirlo visible es lo que hace que degrade del lado seguro: sin JavaScript el panel se queda
 * desplegado —imperfecto en un movil, pero utilizable— y nunca una navegacion que no se puede
 * abrir.
 *
 * El `id` es el que apunta `aria-controls` del boton. El panel de administracion usa el MISMO,
 * porque nunca coexisten en una pagina y asi el boton sirve para los dos sin saber en cual esta.
 */

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
