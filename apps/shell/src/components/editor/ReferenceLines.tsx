"use client";

import {
  REFERENCE_STYLES,
  MAX_REFERENCES,
  type ReferenceStyle,
  type ReferenceLine,
} from "@app/ui-components";
import { ColorPalette } from "./EditorTextStyle";
import { useTranslator } from "../Locale";

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
  const t = useTranslator();
  const cambiar = (siguiente: ReferenceLine[]) =>
    onCambiar(siguiente.length === 0 ? undefined : siguiente);

  const edit = (i: number, change: Partial<ReferenceLine>) =>
    cambiar(lineas.map((line, j) => (i === j ? { ...line, ...change } : line)));

  return (
    <>
      {lineas.map((line, i) => (
        <fieldset key={i} className="referencia" data-testid={`${prueba}-linea-${i}`}>
          <legend className="reference__title">Linea {i + 1}</legend>

          <div className="form__pair">
            <label className="form__field">
              <span>{t('reference.value')}</span>
              <input
                type="number"
                defaultValue={line.valor}
                disabled={saving}
                data-testid={`${prueba}-valor-${i}`}
                onBlur={(e) => edit(i, { valor: Number(e.target.value) })}
              />
            </label>
            <label className="form__field">
              <span>{t('reference.label')}</span>
              <input
                defaultValue={line.etiqueta ?? ""}
                disabled={saving}
                data-testid={`${prueba}-etiqueta-${i}`}
                onBlur={(e) => edit(i, { etiqueta: e.target.value || undefined })}
              />
            </label>
          </div>
          {/*
            Una raya sin rotulo obliga a adivinar que significa. No se impone —a veces el titulo
            del objeto ya lo dice— pero se recomienda donde se escribe.
          */}
          <span className="field__pista">{t('reference.label.hint')}</span>

          <label className="form__field">
            <span>{t('reference.stroke')}</span>
            <select
              value={line.style ?? "discontinua"}
              disabled={saving}
              data-testid={`${prueba}-estilo-${i}`}
              onChange={(e) => edit(i, { style: e.target.value as ReferenceStyle })}
            >
              {REFERENCE_STYLES.map((style) => (
                <option key={style} value={style}>
                  {STYLE_LABEL[style]}
                </option>
              ))}
            </select>
          </label>

          <div className="form__field">
            <span>{t('reference.color')}</span>
            <ColorPalette
              valor={line.color ?? "predeterminado"}
              nombre={`la linea ${i + 1}`}
              prueba={`${prueba}-color-${i}`}
              onCambiar={(color) =>
                edit(i, { color: color === "predeterminado" ? undefined : color })
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
            {t('reference.remove')}
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
          {t('reference.add')}
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
