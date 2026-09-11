'use client';

import { useFiltrosDeUrl } from '../hooks/useFiltrosDeUrl';

/**
 * Segmentador — seccion 4.2, con su seleccion reflejada en la URL (4.11).
 *
 * Su estado NO vive en el componente: vive en la query string. Es lo que hace que la URL sea en
 * todo momento la representacion completa del estado visible, y que una seleccion sea
 * compartible y marcable sin ningun mecanismo aparte.
 *
 * Solo ofrece los valores presentes en el dataset YA filtrado por el ambito, asi que no puede
 * revelar valores fuera del alcance de quien mira.
 */
export function Segmentador({
  titulo,
  campo,
  opciones,
}: {
  titulo: string;
  campo: string;
  opciones: string[];
}) {
  const { valoresDe, alternar, limpiarCampo } = useFiltrosDeUrl();
  const seleccionados = valoresDe(campo);

  return (
    <div className="objeto">
      <div className="objeto__cabecera">
        <h3>{titulo}</h3>
        {seleccionados.length > 0 ? (
          <button type="button" className="boton-enlace" onClick={() => limpiarCampo(campo)}>
            Limpiar
          </button>
        ) : null}
      </div>
      <div className="objeto__cuerpo">
        <ul className="segmentador" data-testid="segmentador">
          {opciones.map((opcion) => {
            const activo = seleccionados.includes(opcion);
            return (
              <li key={opcion}>
                <button
                  type="button"
                  className={`pastilla ${activo ? 'pastilla--activa' : ''}`}
                  aria-pressed={activo}
                  data-testid={`segmentador-${opcion}`}
                  onClick={() => alternar(campo, opcion)}
                >
                  {opcion}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
