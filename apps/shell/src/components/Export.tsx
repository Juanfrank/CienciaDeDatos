'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useUrlFilters } from '../hooks/useUrlFilters';
import { IconButton } from './icons/IconButton';
import { emergente } from './emergentes';
import { exportTracker, type ExportStatus } from './exportJob';
import { useTranslator } from './Locale';

/** Exportar — seccion 4.9, encolado como exige 5.3. */

/*
 * Tres formatos, y ninguno es una imagen.
 *
 * El SVG estaba y se retira: lo que se exporta aqui son los DATOS de un modulo, y una imagen no
 * se abre en una hoja de calculo, no se adjunta a un expediente y no se puede comprobar. Quien
 * queria una figura para una presentacion tiene la captura del navegador, que ademas sale igual a
 * lo que estaba viendo.
 */
const FORMATS = [
  { valor: 'csv', etiqueta: 'CSV' },
  { valor: 'xlsx', etiqueta: 'Excel' },
  { valor: 'pdf', etiqueta: 'PDF' },
] as const;

export function Export({
  moduleSlug,
  pageSlug,
}: {
  moduleSlug: string;
  pageSlug?: string;
}) {
  const t = useTranslator();
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

  /*
   * Lo ya descargado, para no bajarlo dos veces.
   *
   * El sondeo sigue devolviendo «lista» mientras nadie lo pare, asi que sin esta memoria cada
   * vuelta dispararia otra descarga del mismo archivo.
   */
  const bajado = useRef<string | null>(null);

  /*
   * En cuanto el archivo esta, SE DESCARGA. No se ofrece un enlace.
   *
   * Quien pulso «Generar» ya dijo lo que queria; pedirle un segundo clic sobre un enlace que
   * ademas aparece dentro de la barra de iconos es hacerle repetir la misma decision, y deja el
   * archivo esperando a que alguien se acuerde. El aviso de que se genero va al emergente de
   * arriba, que se lee sin buscar y se va solo.
   */
  useEffect(() => {
    const archivo = trabajo?.archivo;
    if (!archivo || bajado.current === archivo.descargarEn) return;
    bajado.current = archivo.descargarEn;

    const enlace = document.createElement('a');
    enlace.href = archivo.descargarEn;
    enlace.download = archivo.nombre;
    enlace.rel = 'noopener';
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();

    emergente(
      `${archivo.nombre} (${Math.max(1, Math.round(archivo.bytes / 1024))} KB) se esta descargando.`,
    );
  }, [trabajo?.archivo]);

  // Un fallo tambien se dice arriba, y con el motivo: dentro de la barra se quedaba en «No se
  // pudo generar», que no da nada con lo que hacer algo.
  useEffect(() => {
    if (trabajo?.estado !== 'fallida') return;
    emergente(trabajo.error ?? 'No se pudo generar la exportacion.', 'fallo');
  }, [trabajo?.estado, trabajo?.error]);

  /** Encolada o generandose: el boton no admite un segundo encargo del mismo. */
  const enCurso = trabajo?.estado === 'encolada' || trabajo?.estado === 'procesando';

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
            {t('notice.format')}
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
          <button
            type="button"
            className="pastilla"
            data-testid="exportar"
            disabled={enCurso}
            onClick={exportar}
          >
            {enCurso ? 'Generando…' : 'Generar'}
          </button>

          {/*
            Lo que esta pasando se dice DENTRO del panel, junto al boton que lo provoco.

            Fuera, en la barra de iconos, este mismo texto era un hueco vacio entre el icono de
            descargar y el siguiente mientras no hubiera nada que decir — un espacio que nadie
            habia puesto y que descuadraba la fila. El resultado final va al emergente de arriba,
            que sobrevive a cerrar el panel.
          */}
          <span className="exportar__status" role="status" data-testid="export-status">
            {enCurso ? 'La exportacion se descargara sola al terminar.' : ''}
          </span>
        </div>
      ) : null}
    </div>
  );
}
