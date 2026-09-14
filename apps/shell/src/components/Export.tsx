'use client';

import { useEffect, useMemo, useState } from 'react';
import { useUrlFilters } from '../hooks/useUrlFilters';
import { IconButton } from './icons/IconButton';
import { exportTracker, type ExportStatus } from './exportJob';

/** Exportar — seccion 4.9, encolado como exige 5.3. */

const FORMATS = [
  { valor: 'csv', etiqueta: 'CSV' },
  { valor: 'xlsx', etiqueta: 'Excel' },
  { valor: 'pdf', etiqueta: 'PDF' },
  { valor: 'svg', etiqueta: 'Imagen (SVG)' },
] as const;

const TEXT: Record<ExportStatus['estado'], string> = {
  encolada: 'En cola…',
  procesando: 'Generando…',
  lista: 'Lista',
  fallida: 'No se pudo generar',
};

export function Export({
  moduleSlug,
  pageSlug,
}: {
  moduleSlug: string;
  pageSlug?: string;
}) {
  const { searchParams } = useUrlFilters();
  const [formato, setFormato] = useState<string>('xlsx');
  const [abierto, setAbierto] = useState(false);
  const [trabajo, setTrabajo] = useState<ExportStatus | null>(null);

  /*
   * El encolado y el sondeo viven en `exportJob`, fuera de React.
   *
   * No es orden por gusto: ahi dentro hay un intervalo y peticiones en vuelo, y esa mezcla se
   * prueba con un reloj falso —que dos «Generar» seguidos no dejan un sondeo huerfano no se ve
   * mirando la pantalla—. Aqui solo queda lo que si es del control: que se ensena.
   */
  const seguidor = useMemo(() => exportTracker(), []);

  // Sin esto, salir de la pagina con una exportacion en curso deja el intervalo corriendo.
  useEffect(() => seguidor.detener, [seguidor]);

  const exportar = () => {
    const filtros: Record<string, string[]> = {};
    for (const clave of new Set(searchParams.keys())) filtros[clave] = searchParams.getAll(clave);

    void seguidor.lanzar(
      { modulo: moduleSlug, ...(pageSlug ? { pagina: pageSlug } : {}), formato, filtros },
      setTrabajo,
    );
  };

  /*
   * El formato se elige DENTRO del panel, no al lado del icono.
   */
  return (
    <div className="exportar">
      <IconButton
        icono="exportar"
        etiqueta="Exportar"
        presionado={abierto}
        data-testid="open-export"
        onClick={() => setAbierto((v) => !v)}
      />

      {abierto ? (
        <div className="exportar__panel" data-testid="export-panel">
          <label className="exportar__label" htmlFor="formato-exportacion">
            Formato
          </label>
          <select
            id="formato-exportacion"
            className="exportar__format"
            value={formato}
            onChange={(e) => setFormato(e.target.value)}
          >
            {FORMATS.map((f) => (
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
      <span className="exportar__status" role="status" aria-live="polite" data-testid="export-status">
        {trabajo ? TEXT[trabajo.estado] : ''}
        {trabajo?.error ? ` — ${trabajo.error}` : ''}
      </span>

      {trabajo?.archivo ? (
        <a
          className="button-link"
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
