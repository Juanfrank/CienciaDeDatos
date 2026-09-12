'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { PozoDeCampos } from '@app/ui-components';
import { Icono } from '../iconos/Icono';

/**
 * Un pozo de campos, al estilo de Power BI.
 *
 * Lo que habia era una lista de casillas con TODOS los campos del dataset a la vista, marcados o
 * no. Con cuatro campos se lee; con cuarenta, el panel se convierte en un listado por el que hay
 * que buscar a ojo, y lo que importa —que hay puesto en este pozo— queda disuelto entre lo que no
 * esta puesto.
 *
 * Aqui solo se ve lo ELEGIDO, como chiclets apilados, y para anadir hay un boton `+` que abre un
 * buscador. La diferencia es de escala: la lista crece con el dataset, los chiclets crecen con lo
 * que uno ha decidido.
 *
 * El emergente se cierra con Escape y al pulsar fuera, y devuelve el foco al boton que lo abrio.
 * Un emergente que se queda abierto al tabular fuera es una trampa para quien navega con teclado.
 */
export function Pozo({
  pozo,
  elegidos,
  disponibles,
  guardando,
  onAnadir,
  onQuitar,
  prueba,
}: {
  pozo: PozoDeCampos;
  elegidos: string[];
  disponibles: string[];
  guardando: boolean;
  onAnadir: (campo: string) => void;
  onQuitar: (campo: string) => void;
  prueba: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const contenedor = useRef<HTMLDivElement>(null);
  const disparador = useRef<HTMLButtonElement>(null);
  const id = useId();

  const lleno = elegidos.length >= pozo.max;

  /*
   * Escape cierra ESTE emergente y no llega a nadie mas.
   *
   * El editor tiene su propio Escape, que deselecciona el bloque. Con los dos escuchando en
   * `document`, cerrar el buscador deseleccionaba ademas el objeto y el panel entero se iba a la
   * tienda: se perdia justo lo que se estaba configurando.
   *
   * Se registra en fase de CAPTURA y se corta la propagacion ahi. Es la regla que se espera de
   * unas capas superpuestas —cierra la de dentro— y, al ir por captura, no depende del orden en
   * que se hayan registrado los manejadores.
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
        {pozo.etiqueta}
        <span className="pozo__cupo" aria-hidden="true">
          {elegidos.length}/{pozo.max}
        </span>
      </p>
      {pozo.ayuda ? <p className="pozo__ayuda">{pozo.ayuda}</p> : null}

      <ul className="pozo__chiclets" aria-labelledby={`${id}-etiqueta`}>
        {elegidos.map((campo) => (
          <li key={campo}>
            <span className="chiclet" data-testid={`${prueba}-${campo}`}>
              <span className="chiclet__nombre">{campo}</span>
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

        <li>
          <button
            type="button"
            ref={disparador}
            className="chiclet chiclet--anadir"
            aria-expanded={abierto}
            aria-haspopup="dialog"
            aria-label={
              lleno
                ? `${pozo.etiqueta} esta completo (${pozo.max})`
                : `Anadir un campo a ${pozo.etiqueta}`
            }
            disabled={guardando || lleno}
            data-testid={`${prueba}-anadir`}
            onClick={() => {
              setBusqueda('');
              setAbierto((v) => !v);
            }}
          >
            <span aria-hidden="true">+</span>
          </button>
        </li>
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
