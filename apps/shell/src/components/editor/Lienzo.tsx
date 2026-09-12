'use client';

import { GRID_COLUMNS, type GridItem } from '@app/module-model';
import { ObjetoDeModulo } from '../ObjetoDeModulo';
import type { ObjetoSerializado } from '../../server/serializar';

/**
 * El lienzo del editor: el modulo DE VERDAD, con su rejilla a la vista.
 *
 * Dos ideas, y las dos van contra lo que habia:
 *
 * 1. **Se dibuja el modulo, no un formulario.** Cada bloque renderiza con los MISMOS componentes
 *    que la vista publicada y con datos reales ya recortados por el ambito de quien edita. Antes
 *    el editor era una lista de fichas con desplegables: para saber que aspecto tenia lo que se
 *    estaba construyendo habia que publicarlo. Mapear una medida y ver aparecer la cifra es la
 *    diferencia entre editar una configuracion y editar lo que se va a publicar.
 *
 * 2. **La rejilla se ve.** Doce columnas dibujadas detras del contenido. La rejilla siempre
 *    existio —la disposicion se guarda en doce columnas y la validacion rechaza los solapes—,
 *    pero quien editaba no la veia: escribia numeros en unos campos y descubria el resultado
 *    despues. Un contenedor que no se ve es una abstraccion; dibujado, es una herramienta.
 *
 * El bloque NO es un boton: es un contenedor con un boton transparente encima.
 *
 * La primera version envolvia la vista previa entera en un `<button>`, y es invalido — un boton
 * no puede contener controles, y la vista previa lleva los suyos (los complementos, el respaldo
 * del grafico). `nested-interactive` de axe lo rechaza, y con razon: un lector de pantalla anuncia
 * un boton y luego encuentra mas botones dentro, sin forma de decir cual hace que.
 *
 * Separados, cada cosa es lo que parece: el contenido se marca `inert` —queda fuera del foco y
 * del arbol de accesibilidad, porque es una vista previa y no una copia interactiva del modulo— y
 * encima va un boton que solo selecciona, con su nombre completo.
 */
export function Lienzo({
  items,
  objetos,
  seleccion,
  onSeleccionar,
}: {
  items: GridItem[];
  objetos: ObjetoSerializado[];
  seleccion: string | null;
  onSeleccionar: (itemId: string | null) => void;
}) {
  const porId = new Map(objetos.map((o) => [o.itemId, o]));

  /*
   * Dos filas de mas, siempre.
   *
   * Sin ellas la rejilla mide exactamente lo que ocupa el contenido y no queda ni un hueco de
   * guias a la vista: las columnas solo se veian con el modulo vacio, justo cuando menos falta
   * hacen. Con dos filas libres debajo, se ve DONDE cabe lo siguiente, que es para lo que sirve
   * ver la rejilla.
   */
  const filasUsadas = items.reduce((m, i) => Math.max(m, i.position.y + i.position.h), 0);
  const filas = filasUsadas + 2;

  return (
    <div
      className="lienzo"
      data-testid="lienzo"
      // Pulsar el fondo deselecciona, como en cualquier editor de bloques. Es un div y no un
      // boton a proposito: no es una accion que haga falta alcanzar con el tabulador —Escape ya
      // deselecciona— y envolver el lienzo entero en un boton anidaria botones dentro de botones.
      onClick={() => onSeleccionar(null)}
    >
      <div
        className="lienzo__rejilla"
        style={
          {
            '--rejilla-columnas': GRID_COLUMNS,
            gridTemplateRows: `repeat(${filas}, minmax(56px, auto))`,
          } as React.CSSProperties
        }
      >
        {/*
          Las guias de columna. Decorativas: `aria-hidden`, porque para quien no ve la pantalla la
          rejilla no aporta nada y anunciar doce celdas vacias antes de cada objeto seria ruido.
          La posicion de cada bloque se dice con palabras en el panel.
        */}
        <div className="lienzo__guias" aria-hidden="true">
          {Array.from({ length: GRID_COLUMNS }, (_, i) => (
            <span key={i} className="lienzo__guia" />
          ))}
        </div>

        {items.map((item) => {
          const objeto = porId.get(item.id);
          const elegido = seleccion === item.id;
          return (
            <div
              key={item.id}
              className="lienzo__bloque"
              data-testid={`bloque-${item.id}`}
              data-elegido={elegido ? 'si' : 'no'}
              style={
                {
                  gridColumn: `${item.position.x + 1} / span ${item.position.w}`,
                  gridRow: `${item.position.y + 1} / span ${item.position.h}`,
                } as React.CSSProperties
              }
            >
              <span className="lienzo__medida" aria-hidden="true">
                {item.position.w}×{item.position.h}
              </span>
              <div className="lienzo__contenido" {...({ inert: '' } as Record<string, string>)}>
                {objeto ? (
                  <ObjetoDeModulo objeto={objeto} />
                ) : (
                  <p className="texto-atenuado">Sin datos todavia.</p>
                )}
              </div>
              <button
                type="button"
                className="lienzo__seleccionar"
                data-testid={`elegir-${item.id}`}
                aria-pressed={elegido}
                // El nombre dice QUE es y DONDE esta: la rejilla se ve con los ojos, y quien no la
                // ve necesita esa misma informacion dicha con palabras.
                aria-label={`${item.instance.title ?? item.instance.objectId}, columna ${
                  item.position.x + 1
                } a ${item.position.x + item.position.w} de ${GRID_COLUMNS}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSeleccionar(item.id);
                }}
              />
            </div>
          );
        })}
      </div>

      {items.length === 0 ? (
        <p className="lienzo__vacio" data-testid="lienzo-vacio">
          Este modulo esta vacio. Elija una visualizacion en el panel de la derecha.
        </p>
      ) : null}
    </div>
  );
}
