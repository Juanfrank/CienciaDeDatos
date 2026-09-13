"use client";

import {
  REFERENCE_STYLES,
  MAX_REFERENCES,
  type ReferenceStyle,
  type ReferenceLine,
} from "@app/ui-components";
import { PaletaDeColores } from "./EstiloDeTextoEditor";

/** Editor de lineas de referencia — la meta, el promedio, el umbral. */

const ETIQUETA_DE_ESTILO: Record<ReferenceStyle, string> = {
  solida: "Continua",
  discontinua: "Discontinua",
  punteada: "Punteada",
};

export function LineasDeReferencia({
  lineas,
  guardando,
  prueba,
  onCambiar,
}: {
  lineas: ReferenceLine[];
  guardando: boolean;
  prueba: string;
  onCambiar: (lineas: ReferenceLine[] | undefined) => void;
}) {
  // Una lista vacia se guarda como `undefined`: «sin lineas» y «una lista de cero lineas» son lo
  // mismo para quien dibuja, y dejar el array vacio ensuciaria la presentacion guardada.
  const cambiar = (siguiente: ReferenceLine[]) =>
    onCambiar(siguiente.length === 0 ? undefined : siguiente);

  const editar = (i: number, cambio: Partial<ReferenceLine>) =>
    cambiar(lineas.map((line, j) => (i === j ? { ...line, ...cambio } : line)));

  return (
    <>
      {lineas.map((line, i) => (
        <fieldset key={i} className="referencia" data-testid={`${prueba}-linea-${i}`}>
          <legend className="referencia__titulo">Linea {i + 1}</legend>

          <div className="formulario__pareja">
            <label className="formulario__campo">
              <span>Valor</span>
              <input
                type="number"
                defaultValue={line.valor}
                disabled={guardando}
                data-testid={`${prueba}-valor-${i}`}
                onBlur={(e) => editar(i, { valor: Number(e.target.value) })}
              />
            </label>
            <label className="formulario__campo">
              <span>Rotulo</span>
              <input
                defaultValue={line.etiqueta ?? ""}
                disabled={guardando}
                data-testid={`${prueba}-etiqueta-${i}`}
                onBlur={(e) => editar(i, { etiqueta: e.target.value || undefined })}
              />
            </label>
          </div>
          {/*
            Una raya sin rotulo obliga a adivinar que significa. No se impone —a veces el titulo
            del objeto ya lo dice— pero se recomienda donde se escribe.
          */}
          <span className="campo__pista">Sin rotulo, la raya no dice que representa.</span>

          <label className="formulario__campo">
            <span>Trazo</span>
            <select
              value={line.style ?? "discontinua"}
              disabled={guardando}
              data-testid={`${prueba}-estilo-${i}`}
              onChange={(e) => editar(i, { style: e.target.value as ReferenceStyle })}
            >
              {REFERENCE_STYLES.map((style) => (
                <option key={style} value={style}>
                  {ETIQUETA_DE_ESTILO[style]}
                </option>
              ))}
            </select>
          </label>

          <div className="formulario__campo">
            <span>Color</span>
            <PaletaDeColores
              valor={line.color ?? "predeterminado"}
              nombre={`la linea ${i + 1}`}
              prueba={`${prueba}-color-${i}`}
              onCambiar={(color) =>
                editar(i, { color: color === "predeterminado" ? undefined : color })
              }
            />
          </div>

          <button
            type="button"
            className="md-boton md-boton--texto"
            disabled={guardando}
            data-testid={`${prueba}-quitar-${i}`}
            onClick={() => cambiar(lineas.filter((_, j) => j !== i))}
          >
            Quitar esta linea
          </button>
        </fieldset>
      ))}

      {lineas.length < MAX_REFERENCES ? (
        <button
          type="button"
          className="md-boton md-boton--contorno"
          disabled={guardando}
          data-testid={`${prueba}-anadir`}
          onClick={() => cambiar([...lineas, { valor: 0, style: "discontinua" }])}
        >
          Anadir linea de referencia
        </button>
      ) : (
        <p className="campo__pista">
          Tres es el maximo: mas rayas sobre un grafico dejan de ser referencias y pasan a ser una
          rejilla.
        </p>
      )}
    </>
  );
}
