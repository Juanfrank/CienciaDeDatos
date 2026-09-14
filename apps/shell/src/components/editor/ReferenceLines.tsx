"use client";

import {
  REFERENCE_STYLES,
  MAX_REFERENCES,
  type ReferenceStyle,
  type ReferenceLine,
} from "@app/ui-components";
import { ColorPalette } from "./EditorTextStyle";

/** Editor de lineas de referencia — la meta, el promedio, el umbral. */

const STYLE_LABEL: Record<ReferenceStyle, string> = {
  solida: "Continua",
  discontinua: "Discontinua",
  punteada: "Punteada",
};

export function ReferenceLines({
  lineas,
  saving,
  prueba,
  onCambiar,
}: {
  lineas: ReferenceLine[];
  saving: boolean;
  prueba: string;
  onCambiar: (lineas: ReferenceLine[] | undefined) => void;
}) {
  // Una lista vacia se guarda como `undefined`: «sin lineas» y «una lista de cero lineas» son lo
  // mismo para quien dibuja, y dejar el array vacio ensuciaria la presentacion guardada.
  const cambiar = (siguiente: ReferenceLine[]) =>
    onCambiar(siguiente.length === 0 ? undefined : siguiente);

  const editar = (i: number, change: Partial<ReferenceLine>) =>
    cambiar(lineas.map((line, j) => (i === j ? { ...line, ...change } : line)));

  return (
    <>
      {lineas.map((line, i) => (
        <fieldset key={i} className="referencia" data-testid={`${prueba}-linea-${i}`}>
          <legend className="reference__title">Linea {i + 1}</legend>

          <div className="form__pair">
            <label className="form__field">
              <span>Valor</span>
              <input
                type="number"
                defaultValue={line.valor}
                disabled={saving}
                data-testid={`${prueba}-valor-${i}`}
                onBlur={(e) => editar(i, { valor: Number(e.target.value) })}
              />
            </label>
            <label className="form__field">
              <span>Rotulo</span>
              <input
                defaultValue={line.etiqueta ?? ""}
                disabled={saving}
                data-testid={`${prueba}-etiqueta-${i}`}
                onBlur={(e) => editar(i, { etiqueta: e.target.value || undefined })}
              />
            </label>
          </div>
          {/*
            Una raya sin rotulo obliga a adivinar que significa. No se impone —a veces el titulo
            del objeto ya lo dice— pero se recomienda donde se escribe.
          */}
          <span className="field__pista">Sin rotulo, la raya no dice que representa.</span>

          <label className="form__field">
            <span>Trazo</span>
            <select
              value={line.style ?? "discontinua"}
              disabled={saving}
              data-testid={`${prueba}-estilo-${i}`}
              onChange={(e) => editar(i, { style: e.target.value as ReferenceStyle })}
            >
              {REFERENCE_STYLES.map((style) => (
                <option key={style} value={style}>
                  {STYLE_LABEL[style]}
                </option>
              ))}
            </select>
          </label>

          <div className="form__field">
            <span>Color</span>
            <ColorPalette
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
            disabled={saving}
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
          disabled={saving}
          data-testid={`${prueba}-anadir`}
          onClick={() => cambiar([...lineas, { valor: 0, style: "discontinua" }])}
        >
          Anadir linea de referencia
        </button>
      ) : (
        <p className="field__pista">
          Tres es el maximo: mas rayas sobre un grafico dejan de ser referencias y pasan a ser una
          rejilla.
        </p>
      )}
    </>
  );
}
