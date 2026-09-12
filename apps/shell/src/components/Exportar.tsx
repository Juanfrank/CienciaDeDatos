'use client';

import { useEffect, useRef, useState } from 'react';
import { useFiltrosDeUrl } from '../hooks/useFiltrosDeUrl';
import { BotonDeIcono } from './iconos/BotonDeIcono';

/**
 * Exportar — seccion 4.9, encolado como exige 5.3.
 *
 * La interfaz refleja la arquitectura en vez de disimularla: al pulsar no aparece un archivo,
 * aparece un estado. Es lo correcto, porque el archivo se genera en otro sitio y puede tardar;
 * fingir que es instantaneo obligaria a mantener la solicitud abierta, que es exactamente lo que
 * 5.3 prohibe.
 *
 * Se exporta LO QUE SE VE: los filtros que viajan son los de la URL, que segun 4.11 son la
 * representacion completa del estado visible. El ambito no se envia ni se puede enviar — lo
 * resuelve el servidor al generar el archivo.
 */

const FORMATOS = [
  { valor: 'csv', etiqueta: 'CSV' },
  { valor: 'xlsx', etiqueta: 'Excel' },
  { valor: 'pdf', etiqueta: 'PDF' },
  { valor: 'svg', etiqueta: 'Imagen (SVG)' },
] as const;

interface Estado {
  id: string;
  estado: 'encolada' | 'procesando' | 'lista' | 'fallida';
  error?: string;
  archivo?: { nombre: string; bytes: number; descargarEn: string };
}

const TEXTO: Record<Estado['estado'], string> = {
  encolada: 'En cola…',
  procesando: 'Generando…',
  lista: 'Lista',
  fallida: 'No se pudo generar',
};

export function Exportar({
  moduleSlug,
  pageSlug,
}: {
  moduleSlug: string;
  pageSlug?: string;
}) {
  const { searchParams } = useFiltrosDeUrl();
  const [formato, setFormato] = useState<string>('xlsx');
  const [abierto, setAbierto] = useState(false);
  const [trabajo, setTrabajo] = useState<Estado | null>(null);
  const sondeo = useRef<ReturnType<typeof setInterval> | null>(null);

  const detener = () => {
    if (sondeo.current) clearInterval(sondeo.current);
    sondeo.current = null;
  };

  // Sin esto, salir de la pagina con una exportacion en curso deja el intervalo corriendo.
  useEffect(() => detener, []);

  const exportar = async () => {
    detener();
    const filtros: Record<string, string[]> = {};
    for (const clave of new Set(searchParams.keys())) filtros[clave] = searchParams.getAll(clave);

    const respuesta = await fetch('/api/exportaciones', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        modulo: moduleSlug,
        pagina: pageSlug,
        formato,
        filtros,
      }),
    });

    if (!respuesta.ok) {
      setTrabajo({ id: '', estado: 'fallida', error: 'No se pudo encolar la exportacion.' });
      return;
    }

    const { id } = (await respuesta.json()) as { id: string };
    setTrabajo({ id, estado: 'encolada' });

    sondeo.current = setInterval(() => {
      void (async () => {
        const r = await fetch(`/api/exportaciones/${id}`);
        if (!r.ok) {
          detener();
          setTrabajo({ id, estado: 'fallida', error: 'La exportacion ya no esta disponible.' });
          return;
        }
        const estado = (await r.json()) as Estado;
        setTrabajo(estado);
        if (estado.estado === 'lista' || estado.estado === 'fallida') detener();
      })();
    }, 600);
  };

  /*
   * El formato se elige DENTRO del panel, no al lado del icono.
   *
   * Exportar es la unica de las cinco acciones que necesita una decision antes de dispararse, y
   * por eso es la unica cuyo icono abre algo en vez de actuar. Dejar el selector suelto en la
   * barra obligaba a que la barra mezclara controles de dos tamanos y dos naturalezas.
   */
  return (
    <div className="exportar">
      <BotonDeIcono
        icono="exportar"
        etiqueta="Exportar"
        presionado={abierto}
        data-testid="abrir-exportar"
        onClick={() => setAbierto((v) => !v)}
      />

      {abierto ? (
        <div className="exportar__panel" data-testid="panel-exportar">
          <label className="exportar__etiqueta" htmlFor="formato-exportacion">
            Formato
          </label>
          <select
            id="formato-exportacion"
            className="exportar__formato"
            value={formato}
            onChange={(e) => setFormato(e.target.value)}
          >
            {FORMATOS.map((f) => (
              <option key={f.valor} value={f.valor}>
                {f.etiqueta}
              </option>
            ))}
          </select>
          <button type="button" className="pastilla" data-testid="exportar" onClick={exportar}>
            Generar
          </button>
        </div>
      ) : null}

      {/*
        La region viva vive FUERA del panel.

        Si estuviera dentro, cerrar el panel la desmontaria y el anuncio de "lista" se perderia
        justo para quien depende de el. Una exportacion tarda, y lo normal es cerrar el panel
        mientras tanto.
      */}
      <span className="exportar__estado" role="status" aria-live="polite" data-testid="estado-exportacion">
        {trabajo ? TEXTO[trabajo.estado] : ''}
        {trabajo?.error ? ` — ${trabajo.error}` : ''}
      </span>

      {trabajo?.archivo ? (
        <a
          className="boton-enlace"
          href={trabajo.archivo.descargarEn}
          download={trabajo.archivo.nombre}
          data-testid="descargar-exportacion"
        >
          Descargar {trabajo.archivo.nombre} ({Math.max(1, Math.round(trabajo.archivo.bytes / 1024))} KB)
        </a>
      ) : null}
    </div>
  );
}
