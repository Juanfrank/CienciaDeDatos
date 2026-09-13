"use client";

import type { QueryResult } from "@app/data-contracts";
import type { IconName, ObjectInstance } from "@app/ui-components";
import { useFiltrosDeUrl } from "../hooks/useFiltrosDeUrl";
import { Marco } from "./objetos";

/** Segmentador — seccion 4.2, con su seleccion reflejada en la URL (4.11). */
export function Segmentador({
  titulo,
  fieldName,
  opciones,
  instance,
  result,
  objectIcon,
}: {
  titulo: string;
  fieldName: string;
  opciones: string[];
  /** Se pasan para que un segmentador pueda llevar complementos como cualquier otro objeto. */
  instance?: ObjectInstance;
  result?: QueryResult;
  /** El icono que declara la version del objeto en el catalogo. */
  objectIcon?: IconName;
}) {
  const { valoresDe, alternar, limpiarCampo } = useFiltrosDeUrl();
  const seleccionados = valoresDe(fieldName);

  return (
    <Marco
      titulo={titulo}
      {...(instance ? { instance } : {})}
      {...(result ? { result } : {})}
      {...(objectIcon ? { objectIcon } : {})}
      accion={
        seleccionados.length > 0 ? (
          <button
            type="button"
            className="boton-enlace"
            onClick={() => limpiarCampo(fieldName)}
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
                onClick={() => alternar(fieldName, opcion)}
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
