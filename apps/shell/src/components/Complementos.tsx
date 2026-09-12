'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { QueryResult } from '@app/data-contracts';
import { Icono } from './iconos/Icono';
import {
  aggregateBy,
  attachmentOf,
  desgloseDe,
  fieldKey,
  proyectarObjeto,
  type ObjectInstance,
} from '@app/ui-components';

/**
 * Objetos adjuntados — complementos de un objeto, nunca objetos independientes.
 *
 * Se dibujan en la cabecera del objeto anfitrion como iconos. No ocupan celda en la rejilla y no
 * se enlazan contra ningun dataset: leen el del anfitrion, que ya viene filtrado por el ambito de
 * quien mira. Por eso un complemento no puede revelar nada que la persona no pudiera ver de
 * todas formas.
 */

const formatearCelda = (celda: unknown): string =>
  typeof celda === 'number' ? new Intl.NumberFormat('es-DO').format(celda) : String(celda ?? '');

/**
 * Tooltip explicativo.
 *
 * No es el tooltip de eje ni el de un punto de datos: explica que representa el objeto ENTERO.
 *
 * Cumple 1.4.13 de WCAG (contenido al pasar el puntero o al enfocar), que es donde casi todos
 * los tooltips fallan: aparece tambien al enfocar con teclado, se cierra con Escape, y se puede
 * llevar el puntero encima sin que desaparezca —hace falta para leerlo despacio o para
 * seleccionar el texto.
 */
export function TooltipExplicativo({ texto, titulo }: { texto: string; titulo: string }) {
  const id = useId();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setVisible(false);
    };
    document.addEventListener('keydown', alPulsar);
    return () => document.removeEventListener('keydown', alPulsar);
  }, [visible]);

  return (
    <span
      className="complemento"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <button
        type="button"
        className="complemento__icono"
        aria-describedby={visible ? id : undefined}
        aria-label={`Que muestra «${titulo}»`}
        data-testid={`tooltip-icono-${titulo}`}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        // El icono es decorativo: el nombre accesible lo da aria-label, asi que se oculta del
        // arbol para que un lector de pantalla no lea "i" antes de la etiqueta.
      >
        <Icono nombre="informacion" tamano={18} />
      </button>
      {visible ? (
        <span role="tooltip" id={id} className="complemento__tooltip" data-testid={`tooltip-${titulo}`}>
          {texto}
        </span>
      ) : null}
    </span>
  );
}

/**
 * Tabla de datos emergente.
 *
 * Con alcance de OBJETO muestra las filas de origen del objeto entero. Con alcance de SUBOBJETO
 * lista primero las categorias que el objeto muestra y, al elegir una, las filas que hay detras
 * de ESE numero — que es justo la granularidad que el objeto agrego y dejo de mostrar.
 *
 * Se usa el `<dialog>` nativo con `showModal`: trae el atrapado de foco, el cierre con Escape y
 * la inercia del fondo sin reimplementarlos, y reimplementarlos es donde se rompen.
 */
export function TablaDeDatos({
  instance,
  result,
  titulo,
  scope,
}: {
  instance: ObjectInstance;
  result: QueryResult;
  titulo: string;
  scope: 'objeto' | 'subobjeto';
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [abierto, setAbierto] = useState(false);
  const [seleccion, setSeleccion] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    const el = dialogo.current;
    if (!el) return;
    if (abierto && !el.open) el.showModal();
    if (!abierto && el.open) el.close();
  }, [abierto]);

  const cerrar = () => {
    setAbierto(false);
    setSeleccion(null);
  };

  const dimensiones = instance.binding.dimensions;
  const categorias =
    scope === 'subobjeto'
      ? aggregateBy(result, dimensiones, instance.binding.measures).rows
      : [];

  // Con alcance de objeto se muestran las filas de ORIGEN, sin agregar: lo interesante del
  // emergente es precisamente lo que el objeto no ensena. Con alcance de subobjeto, lo mismo
  // pero acotado a la categoria elegida.
  const filas = seleccion ? desgloseDe(result, seleccion) : result;
  const proyeccion = proyectarObjeto(instance, result);

  const etiquetaSeleccion = seleccion ? Object.values(seleccion).join(' / ') : null;

  return (
    <>
      <button
        type="button"
        className="complemento__icono"
        aria-label={`Ver los datos de origen de «${titulo}»`}
        data-testid={`tabla-datos-abrir-${titulo}`}
        onClick={() => setAbierto(true)}
      >
        <Icono nombre="datos" tamano={18} />
      </button>

      <dialog
        ref={dialogo}
        className="emergente"
        data-testid={`tabla-datos-${titulo}`}
        aria-label={`Datos de origen de ${titulo}`}
        // Escape y el clic en el fondo cierran el dialogo nativo por su cuenta; sin esto el
        // estado de React se quedaria diciendo que sigue abierto.
        onClose={cerrar}
      >
        <div className="emergente__cabecera">
          <h2>Datos de origen — {titulo}</h2>
          <button type="button" className="boton-enlace" onClick={cerrar} data-testid="tabla-datos-cerrar">
            Cerrar
          </button>
        </div>

        {scope === 'subobjeto' && !seleccion ? (
          <>
            <p className="texto-atenuado">
              Elija una categoria para ver las filas que hay detras de su cifra.
            </p>
            <div className="tabla-contenedor" tabIndex={0} role="region" aria-label="Categorias">
              <table className="tabla">
                <thead>
                  <tr>
                    {proyeccion.columns.map((c) => (
                      <th key={c.name} scope="col">
                        {c.name}
                      </th>
                    ))}
                    <th scope="col">Origen</th>
                  </tr>
                </thead>
                <tbody>
                  {categorias.map((categoria) => {
                    const clave = categoria.labels.join(' / ');
                    return (
                      <tr key={clave}>
                        <td>{clave}</td>
                        {categoria.values.map((v, i) => (
                          <td key={i} className="es-numero">
                            {formatearCelda(v)}
                          </td>
                        ))}
                        <td>
                          <button
                            type="button"
                            className="boton-enlace"
                            data-testid={`desglosar-${clave}`}
                            onClick={() =>
                              setSeleccion(
                                Object.fromEntries(
                                  dimensiones.map((d, i) => [fieldKey(d), categoria.labels[i] ?? '']),
                                ),
                              )
                            }
                          >
                            Ver filas
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <>
            <p className="texto-atenuado" data-testid="tabla-datos-resumen">
              {etiquetaSeleccion
                ? `${filas.rows.length} fila(s) detras de ${etiquetaSeleccion}.`
                : `${filas.rows.length} fila(s) de origen de este objeto.`}
            </p>
            {etiquetaSeleccion ? (
              <button
                type="button"
                className="boton-enlace"
                data-testid="tabla-datos-volver"
                onClick={() => setSeleccion(null)}
              >
                Volver a las categorias
              </button>
            ) : null}
            <div className="tabla-contenedor" tabIndex={0} role="region" aria-label="Filas de origen">
              <table className="tabla" data-testid="tabla-datos-filas">
                <thead>
                  <tr>
                    {filas.columns.map((c) => (
                      <th key={c.name} scope="col">
                        {c.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filas.rows.map((fila, i) => (
                    <tr key={i}>
                      {fila.map((celda, j) => (
                        <td key={j} className={typeof celda === 'number' ? 'es-numero' : ''}>
                          {formatearCelda(celda)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </dialog>
    </>
  );
}

/** Los complementos de un objeto, para la cabecera de su marco. */
export function Complementos({
  instance,
  result,
  titulo,
}: {
  instance: ObjectInstance;
  result: QueryResult;
  titulo: string;
}) {
  const tooltip = attachmentOf(instance, 'tooltip-explicativo');
  const tabla = attachmentOf(instance, 'tabla-de-datos');

  if (!tooltip && !tabla) return null;

  return (
    <span className="complementos">
      {tooltip ? <TooltipExplicativo texto={tooltip.text} titulo={titulo} /> : null}
      {tabla ? (
        <TablaDeDatos instance={instance} result={result} titulo={titulo} scope={tabla.scope} />
      ) : null}
    </span>
  );
}
