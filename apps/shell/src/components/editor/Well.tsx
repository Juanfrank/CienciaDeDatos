'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { AGGREGATIONS, type Aggregation } from '@app/data-contracts';
import { AGGREGATION_LABEL, type FieldWell } from '@app/ui-components';
import { Icon } from '../icons/Icon';
import { Help } from './Help';

/** Un pozo de campos, al estilo de Power BI. */
export function Well({
  well,
  elegidos,
  available,
  saving,
  lleno: llenoExterno,
  onAnadir,
  onQuitar,
  aggregationOf,
  onAgregacion,
  possible,
  prueba,
}: {
  well: FieldWell;
  elegidos: string[];
  available: string[];
  saving: boolean;
  /** Si la ranura ya no admite mas. */
  lleno?: boolean;
  onAnadir: (fieldName: string) => void;
  onQuitar: (fieldName: string) => void;
  /** Como se resume cada campo de este pozo, y como cambiarlo. */
  aggregationOf?: (fieldName: string) => Aggregation;
  onAgregacion?: (fieldName: string, aggregation: Aggregation) => void;
  /** Los operadores que se pueden aplicar aqui, del grano del dataset y de si el objeto colapsa. */
  possible?: Aggregation[];
  prueba: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const contenedor = useRef<HTMLDivElement>(null);
  const disparador = useRef<HTMLButtonElement>(null);
  const id = useId();

  const lleno = llenoExterno ?? elegidos.length >= well.max;
  const obligatorio = (well.min ?? 0) > 0;

  /*
   * Escape cierra ESTE emergente y no llega a nadie mas.
   */
  useEffect(() => {
    if (!abierto) return;
    const toClickKeystroke = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      setAbierto(false);
      disparador.current?.focus();
    };
    const toClickOutside = (e: MouseEvent) => {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('keydown', toClickKeystroke, true);
    document.addEventListener('mousedown', toClickOutside);
    return () => {
      document.removeEventListener('keydown', toClickKeystroke, true);
      document.removeEventListener('mousedown', toClickOutside);
    };
  }, [abierto]);

  const candidatos = available.filter((c) =>
    busqueda ? c.toLowerCase().includes(busqueda.toLowerCase()) : true,
  );

  return (
    <div className="pozo" ref={contenedor} data-testid={prueba}>
      <p className="well__label" id={`${id}-etiqueta`}>
        <span className="well__name">
          {well.etiqueta}
          {/*
            El asterisco rojo, y NADA MAS.
            Antes lo obligatorio se decia en la ayuda («Opcional. Agrupa las barras…») y habia que
            leerla entera para enterarse, y solo en las ranuras que la traian. El asterisco es la
            convencion de cualquier formulario: se reconoce sin leer. Va con `aria-hidden` y la
            palabra completa al lado, porque «asterisco» no significa nada dicho en voz alta.
          */}
          {obligatorio ? (
            <>
              <span className="well__obligatorio" aria-hidden="true">
                *
              </span>
              <span className="visualmente-oculto">(obligatorio)</span>
            </>
          ) : null}
          {well.help ? <Help content={well.help} de={well.etiqueta} /> : null}
        </span>
        <span className="well__cupo" aria-hidden="true">
          {elegidos.length}/{well.max}
        </span>
      </p>

      <ul className="well__chiclets" aria-labelledby={`${id}-etiqueta`}>
        {elegidos.map((fieldName) => (
          <li key={fieldName}>
            <span className="chiclet" data-testid={`${prueba}-${fieldName}`}>
              <span className="chip__name">{fieldName}</span>
              {well.tipo === 'medida' && aggregationOf && onAgregacion ? (
                /*
                 * Solo el chevron. El operador activo se ve AL ABRIR, no antes.
                 */
                <label className="chip__aggregation">
                  <span className="visualmente-oculto">Como se resume {fieldName}</span>
                  <select
                    value={aggregationOf(fieldName)}
                    disabled={saving}
                    data-testid={`${prueba}-agregacion-${fieldName}`}
                    // El titulo es lo unico que dice el operador sin abrir el menu: para el raton
                    // al pasar por encima, y ahi no estorba a nada.
                    title={`Se resume con ${AGGREGATION_LABEL[aggregationOf(fieldName)].toLowerCase()}`}
                    onChange={(e) => onAgregacion(fieldName, e.target.value as Aggregation)}
                  >
                    {(possible ?? AGGREGATIONS).map((a) => (
                      <option key={a} value={a}>
                        {AGGREGATION_LABEL[a]}
                      </option>
                    ))}
                    {/*
                      El operador guardado, si ya no se puede aplicar.
                      Pasa cuando el grano del dataset cambia con el modulo ya publicado. No se
                      ofrece —va deshabilitado— pero tiene que estar, o el `select` mostraria otro
                      valor distinto del guardado y quien edita creeria que ya lo arreglo.
                    */}
                    {possible && !possible.includes(aggregationOf(fieldName)) ? (
                      <option value={aggregationOf(fieldName)} disabled>
                        {AGGREGATION_LABEL[aggregationOf(fieldName)]} (no aplicable aqui)
                      </option>
                    ) : null}
                  </select>
                  <Icon nombre="chevron-abajo" tamano={12} />
                </label>
              ) : null}
              <button
                type="button"
                className="chip__remove"
                // El nombre del campo va EN la etiqueta: con varios chiclets, diez botones que
                // dicen «Quitar» no se distinguen entre si en una lista de enlaces.
                aria-label={`Quitar ${fieldName} de ${well.etiqueta}`}
                disabled={saving}
                data-testid={`${prueba}-quitar-${fieldName}`}
                onClick={() => onQuitar(fieldName)}
              >
                <Icon nombre="close" tamano={14} />
              </button>
            </span>
          </li>
        ))}

        {/*
          Con el pozo lleno NO hay `+`.

          Estaba y se apagaba, y un boton apagado es una promesa que no se cumple: ocupa sitio,
          invita a pulsarlo y no explica que hay que quitar algo antes. Quitarlo lo dice solo — el
          hueco donde estaba desaparece en cuanto el pozo se completa, y vuelve al quitar un
          campo. El cupo «1/1» de la cabecera sigue diciendo por que.
        */}
        {lleno ? null : (
          <li>
            <button
              type="button"
              ref={disparador}
              className="chiclet add-chip"
              aria-expanded={abierto}
              aria-haspopup="dialog"
              aria-label={`Anadir un campo a ${well.etiqueta}`}
              disabled={saving}
              data-testid={`${prueba}-anadir`}
              onClick={() => {
                setBusqueda('');
                setAbierto((v) => !v);
              }}
            >
              <span aria-hidden="true">+</span>
            </button>
          </li>
        )}
      </ul>

      {abierto ? (
        <div className="well__popover" role="dialog" aria-label={`Campos para ${well.etiqueta}`}>
          <input
            type="search"
            className="well__search"
            placeholder="Buscar campo…"
            aria-label={`Buscar un campo para ${well.etiqueta}`}
            autoFocus
            value={busqueda}
            data-testid={`${prueba}-buscar`}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          <ul className="well__candidatos">
            {candidatos.map((fieldName) => {
              const puesto = elegidos.includes(fieldName);
              return (
                <li key={fieldName}>
                  <label>
                    <input
                      type="checkbox"
                      checked={puesto}
                      // Lo que ya esta puesto se puede quitar desde aqui; lo que no cabe se ofrece
                      // apagado en vez de desaparecer, para que se vea que existe y por que no.
                      disabled={saving || (!puesto && lleno)}
                      data-testid={`${prueba}-opcion-${fieldName}`}
                      onChange={() => (puesto ? onQuitar(fieldName) : onAnadir(fieldName))}
                    />
                    {fieldName}
                  </label>
                </li>
              );
            })}
            {candidatos.length === 0 ? (
              <li className="muted-text">Ningun fieldName coincide.</li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
