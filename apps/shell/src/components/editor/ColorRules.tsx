"use client";

import {
  COMPARATORS,
  MAX_RULES,
  type Comparator,
  type ColorRule,
} from "@app/ui-components";
import { ColorPalette } from "./EditorTextStyle";

/** Editor de formato condicional — que el color dependa del DATO. */

const COMPARATOR_LABEL: Record<Comparator, string> = {
  mayor: "Mayor que",
  "mayor-o-igual": "Mayor o igual que",
  menor: "Menor que",
  "menor-o-igual": "Menor o igual que",
  igual: "Igual a",
  entre: "Entre",
};

export function ColorRules({
  rules,
  medidas,
  saving,
  prueba,
  onCambiar,
}: {
  rules: ColorRule[];
  /** Las medidas mapeadas, para poder acotar una regla a una sola. */
  medidas: string[];
  saving: boolean;
  prueba: string;
  onCambiar: (rules: ColorRule[] | undefined) => void;
}) {
  const cambiar = (siguiente: ColorRule[]) =>
    onCambiar(siguiente.length === 0 ? undefined : siguiente);

  const editar = (i: number, change: Partial<ColorRule>) =>
    cambiar(rules.map((colorRule, j) => (i === j ? { ...colorRule, ...change } : colorRule)));

  const mover = (i: number, delta: number) => {
    const j = i + delta;
    if (j < 0 || j >= rules.length) return;
    const siguiente = [...rules];
    const [sacada] = siguiente.splice(i, 1);
    if (sacada) siguiente.splice(j, 0, sacada);
    cambiar(siguiente);
  };

  return (
    <>
      {rules.length > 1 ? (
        <p className="field__pista">
          Se aplica la PRIMERA que se cumple. Use las flechas para cambiar cual manda.
        </p>
      ) : null}

      {rules.map((colorRule, i) => (
        <fieldset key={i} className="referencia" data-testid={`${prueba}-regla-${i}`}>
          <legend className="reference__title">Regla {i + 1}</legend>

          <label className="form__field">
            <span>Se aplica a</span>
            <select
              value={colorRule.medida ?? ""}
              disabled={saving}
              data-testid={`${prueba}-medida-${i}`}
              onChange={(e) => editar(i, { medida: e.target.value || undefined })}
            >
              <option value="">Todas las medidas</option>
              {medidas.map((medida) => (
                <option key={medida} value={medida}>
                  {medida}
                </option>
              ))}
            </select>
            {/*
              Acotar a una medida no es un lujo: «mayor que 90» significa una cosa en dias y un
              disparate en casos, y un objeto puede llevar las dos a la vez.
            */}
          </label>

          <div className="form__pair">
            <label className="form__field">
              <span>Cuando el valor es</span>
              <select
                value={colorRule.comparator}
                disabled={saving}
                data-testid={`${prueba}-comparador-${i}`}
                onChange={(e) => editar(i, { comparator: e.target.value as Comparator })}
              >
                {COMPARATORS.map((c) => (
                  <option key={c} value={c}>
                    {COMPARATOR_LABEL[c]}
                  </option>
                ))}
              </select>
            </label>
            <label className="form__field">
              <span>{colorRule.comparator === "entre" ? "Desde" : "Valor"}</span>
              <input
                type="number"
                defaultValue={colorRule.valor}
                disabled={saving}
                data-testid={`${prueba}-valor-${i}`}
                onBlur={(e) => editar(i, { valor: Number(e.target.value) })}
              />
            </label>
          </div>

          {colorRule.comparator === "entre" ? (
            <label className="form__field">
              <span>Hasta</span>
              <input
                type="number"
                defaultValue={colorRule.hasta ?? ""}
                disabled={saving}
                data-testid={`${prueba}-hasta-${i}`}
                onBlur={(e) =>
                  editar(i, { hasta: e.target.value === "" ? undefined : Number(e.target.value) })
                }
              />
              {/* Sin el otro extremo la regla no casa nunca, y se rechaza al guardar. */}
              <span className="field__pista">Los dos extremos entran.</span>
            </label>
          ) : null}

          <div className="form__field">
            <span>Color</span>
            <ColorPalette
              valor={colorRule.color}
              nombre={`la regla ${i + 1}`}
              prueba={`${prueba}-color-${i}`}
              onCambiar={(color) => editar(i, { color })}
            />
          </div>

          <div className="reference__actions">
            <button
              type="button"
              className="md-boton md-boton--texto"
              disabled={saving || i === 0}
              data-testid={`${prueba}-subir-${i}`}
              onClick={() => mover(i, -1)}
            >
              Subir
            </button>
            <button
              type="button"
              className="md-boton md-boton--texto"
              disabled={saving || i === rules.length - 1}
              data-testid={`${prueba}-bajar-${i}`}
              onClick={() => mover(i, 1)}
            >
              Bajar
            </button>
            <button
              type="button"
              className="md-boton md-boton--texto"
              disabled={saving}
              data-testid={`${prueba}-quitar-${i}`}
              onClick={() => cambiar(rules.filter((_, j) => j !== i))}
            >
              Quitar
            </button>
          </div>
        </fieldset>
      ))}

      {rules.length < MAX_RULES ? (
        <button
          type="button"
          className="md-boton md-boton--contorno"
          disabled={saving}
          data-testid={`${prueba}-anadir`}
          onClick={() => cambiar([...rules, { comparator: "mayor", valor: 0, color: "error" }])}
        >
          Anadir colorRule de color
        </button>
      ) : (
        <p className="field__pista">
          Cinco es el maximo: mas reglas dejan de ser excepciones y pasan a ser una escala, que es
          otra herramienta.
        </p>
      )}
    </>
  );
}
