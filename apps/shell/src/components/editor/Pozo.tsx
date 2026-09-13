'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { AGGREGATIONS, type Aggregation } from '@app/data-contracts';
import { ETIQUETA_DE_AGREGACION, type PozoDeCampos } from '@app/ui-components';
import { Icono } from '../iconos/Icono';
import { Ayuda } from './Ayuda';

/** Un pozo de campos, al estilo de Power BI. */
export function Pozo({
  pozo,
  elegidos,
  disponibles,
  guardando,
  lleno: llenoExterno,
  onAnadir,
  onQuitar,
  agregacionDe,
  onAgregacion,
  posibles,
  prueba,
}: {
  pozo: PozoDeCampos;
  elegidos: string[];
  disponibles: string[];
  guardando: boolean;
  /** Si la ranura ya no admite mas. */
  lleno?: boolean;
  onAnadir: (campo: string) => void;
  onQuitar: (campo: string) => void;
  /** Como se resume cada campo de este pozo, y como cambiarlo. */
  agregacionDe?: (campo: string) => Aggregation;
  onAgregacion?: (campo: string, aggregation: Aggregation) => void;
  /** Los operadores que se pueden aplicar aqui, del grano del dataset y de si el objeto colapsa. */
  posibles?: Aggregation[];
  prueba: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const contenedor = useRef<HTMLDivElement>(null);
  const disparador = useRef<HTMLButtonElement>(null);
  const id = useId();

  const lleno = llenoExterno ?? elegidos.length >= pozo.max;
  const obligatorio = (pozo.min ?? 0) > 0;

  /*
   * Escape cierra ESTE emergente y no llega a nadie mas.
   */
  useEffect(() => {
    if (!abierto) return;
    const alPulsarTecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      setAbierto(false);
      disparador.current?.focus();
    };
    const alPulsarFuera = (e: MouseEvent) => {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('keydown', alPulsarTecla, true);
    document.addEventListener('mousedown', alPulsarFuera);
    return () => {
      document.removeEventListener('keydown', alPulsarTecla, true);
      document.removeEventListener('mousedown', alPulsarFuera);
    };
  }, [abierto]);

  const candidatos = disponibles.filter((c) =>
    busqueda ? c.toLowerCase().includes(busqueda.toLowerCase()) : true,
  );

  return (
    <div className="pozo" ref={contenedor} data-testid={prueba}>
      <p className="pozo__etiqueta" id={`${id}-etiqueta`}>
        <span className="pozo__nombre">
          {pozo.etiqueta}
          {/*
            El asterisco rojo, y NADA MAS.
            Antes lo obligatorio se decia en la ayuda («Opcional. Agrupa las barras…») y habia que
            leerla entera para enterarse, y solo en las ranuras que la traian. El asterisco es la
            convencion de cualquier formulario: se reconoce sin leer. Va con `aria-hidden` y la
            palabra completa al lado, porque «asterisco» no significa nada dicho en voz alta.
          */}
          {obligatorio ? (
            <>
              <span className="pozo__obligatorio" aria-hidden="true">
                *
              </span>
              <span className="visualmente-oculto">(obligatorio)</span>
            </>
          ) : null}
          {pozo.ayuda ? <Ayuda texto={pozo.ayuda} de={pozo.etiqueta} /> : null}
        </span>
        <span className="pozo__cupo" aria-hidden="true">
          {elegidos.length}/{pozo.max}
        </span>
      </p>

      <ul className="pozo__chiclets" aria-labelledby={`${id}-etiqueta`}>
        {elegidos.map((campo) => (
          <li key={campo}>
            <span className="chiclet" data-testid={`${prueba}-${campo}`}>
              <span className="chiclet__nombre">{campo}</span>
              {pozo.tipo === 'medida' && agregacionDe && onAgregacion ? (
                /*
                 * Solo el chevron. El operador activo se ve AL ABRIR, no antes.
                 */
                <label className="chiclet__agregacion">
                  <span className="visualmente-oculto">Como se resume {campo}</span>
                  <select
                    value={agregacionDe(campo)}
                    disabled={guardando}
                    data-testid={`${prueba}-agregacion-${campo}`}
                    // El titulo es lo unico que dice el operador sin abrir el menu: para el raton
                    // al pasar por encima, y ahi no estorba a nada.
                    title={`Se resume con ${ETIQUETA_DE_AGREGACION[agregacionDe(campo)].toLowerCase()}`}
                    onChange={(e) => onAgregacion(campo, e.target.value as Aggregation)}
                  >
                    {(posibles ?? AGGREGATIONS).map((a) => (
                      <option key={a} value={a}>
                        {ETIQUETA_DE_AGREGACION[a]}
                      </option>
                    ))}
                    {/*
                      El operador guardado, si ya no se puede aplicar.
                      Pasa cuando el grano del dataset cambia con el modulo ya publicado. No se
                      ofrece —va deshabilitado— pero tiene que estar, o el `select` mostraria otro
                      valor distinto del guardado y quien edita creeria que ya lo arreglo.
                    */}
                    {posibles && !posibles.includes(agregacionDe(campo)) ? (
                      <option value={agregacionDe(campo)} disabled>
                        {ETIQUETA_DE_AGREGACION[agregacionDe(campo)]} (no aplicable aqui)
                      </option>
                    ) : null}
                  </select>
                  <Icono nombre="chevron-abajo" tamano={12} />
                </label>
              ) : null}
              <button
                type="button"
                className="chiclet__quitar"
                // El nombre del campo va EN la etiqueta: con varios chiclets, diez botones que
                // dicen «Quitar» no se distinguen entre si en una lista de enlaces.
                aria-label={`Quitar ${campo} de ${pozo.etiqueta}`}
                disabled={guardando}
                data-testid={`${prueba}-quitar-${campo}`}
                onClick={() => onQuitar(campo)}
              >
                <Icono nombre="cerrar" tamano={14} />
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
              className="chiclet chiclet--anadir"
              aria-expanded={abierto}
              aria-haspopup="dialog"
              aria-label={`Anadir un campo a ${pozo.etiqueta}`}
              disabled={guardando}
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
        <div className="pozo__emergente" role="dialog" aria-label={`Campos para ${pozo.etiqueta}`}>
          <input
            type="search"
            className="pozo__buscar"
            placeholder="Buscar campo…"
            aria-label={`Buscar un campo para ${pozo.etiqueta}`}
            autoFocus
            value={busqueda}
            data-testid={`${prueba}-buscar`}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          <ul className="pozo__candidatos">
            {candidatos.map((campo) => {
              const puesto = elegidos.includes(campo);
              return (
                <li key={campo}>
                  <label>
                    <input
                      type="checkbox"
                      checked={puesto}
                      // Lo que ya esta puesto se puede quitar desde aqui; lo que no cabe se ofrece
                      // apagado en vez de desaparecer, para que se vea que existe y por que no.
                      disabled={guardando || (!puesto && lleno)}
                      data-testid={`${prueba}-opcion-${campo}`}
                      onChange={() => (puesto ? onQuitar(campo) : onAnadir(campo))}
                    />
                    {campo}
                  </label>
                </li>
              );
            })}
            {candidatos.length === 0 ? (
              <li className="texto-atenuado">Ningun campo coincide.</li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
