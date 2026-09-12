"use client";

import type { QueryResult } from "@app/data-contracts";
import type { ObjectInstance } from "@app/ui-components";
import { useFiltrosDeUrl } from "../hooks/useFiltrosDeUrl";
import { Marco } from "./objetos";

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
  instance,
  result,
}: {
  titulo: string;
  campo: string;
  opciones: string[];
  /** Se pasan para que un segmentador pueda llevar complementos como cualquier otro objeto. */
  instance?: ObjectInstance;
  result?: QueryResult;
}) {
  const { valoresDe, alternar, limpiarCampo } = useFiltrosDeUrl();
  const seleccionados = valoresDe(campo);

  return (
    <Marco
      titulo={titulo}
      {...(instance ? { instance } : {})}
      {...(result ? { result } : {})}
      accion={
        seleccionados.length > 0 ? (
          <button
            type="button"
            className="boton-enlace"
            onClick={() => limpiarCampo(campo)}
          >
            Limpiar
          </button>
        ) : null
      }
    >
      <ul className="segmentador" data-testid="segmentador">
        {opciones.map((opcion) => {
          const activo = seleccionados.includes(opcion);
          return (
            <li key={opcion}>
              <button
                type="button"
                className={`md-chip ${activo ? "md-chip--seleccionado" : ""}`}
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
    </Marco>
  );
}
