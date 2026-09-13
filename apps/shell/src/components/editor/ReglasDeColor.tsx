"use client";

import {
  COMPARADORES,
  MAX_REGLAS,
  type Comparador,
  type ReglaDeColor,
} from "@app/ui-components";
import { PaletaDeColores } from "./EstiloDeTextoEditor";

/** Editor de formato condicional — que el color dependa del DATO. */

const ETIQUETA_DE_COMPARADOR: Record<Comparador, string> = {
  mayor: "Mayor que",
  "mayor-o-igual": "Mayor o igual que",
  menor: "Menor que",
  "menor-o-igual": "Menor o igual que",
  igual: "Igual a",
  entre: "Entre",
};

export function ReglasDeColor({
  rules,
  medidas,
  guardando,
  prueba,
  onCambiar,
}: {
  rules: ReglaDeColor[];
  /** Las medidas mapeadas, para poder acotar una regla a una sola. */
  medidas: string[];
  guardando: boolean;
  prueba: string;
  onCambiar: (rules: ReglaDeColor[] | undefined) => void;
}) {
  const cambiar = (siguiente: ReglaDeColor[]) =>
    onCambiar(siguiente.length === 0 ? undefined : siguiente);

  const editar = (i: number, cambio: Partial<ReglaDeColor>) =>
    cambiar(rules.map((colorRule, j) => (i === j ? { ...colorRule, ...cambio } : colorRule)));

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
        <p className="campo__pista">
          Se aplica la PRIMERA que se cumple. Use las flechas para cambiar cual manda.
        </p>
      ) : null}

      {rules.map((colorRule, i) => (
        <fieldset key={i} className="referencia" data-testid={`${prueba}-regla-${i}`}>
          <legend className="referencia__titulo">Regla {i + 1}</legend>

          <label className="formulario__campo">
            <span>Se aplica a</span>
            <select
              value={colorRule.medida ?? ""}
              disabled={guardando}
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

          <div className="formulario__pareja">
            <label className="formulario__campo">
              <span>Cuando el valor es</span>
              <select
                value={colorRule.comparador}
                disabled={guardando}
                data-testid={`${prueba}-comparador-${i}`}
                onChange={(e) => editar(i, { comparador: e.target.value as Comparador })}
              >
                {COMPARADORES.map((c) => (
                  <option key={c} value={c}>
                    {ETIQUETA_DE_COMPARADOR[c]}
                  </option>
                ))}
              </select>
            </label>
            <label className="formulario__campo">
              <span>{colorRule.comparador === "entre" ? "Desde" : "Valor"}</span>
              <input
                type="number"
                defaultValue={colorRule.valor}
                disabled={guardando}
                data-testid={`${prueba}-valor-${i}`}
                onBlur={(e) => editar(i, { valor: Number(e.target.value) })}
              />
            </label>
          </div>

          {colorRule.comparador === "entre" ? (
            <label className="formulario__campo">
              <span>Hasta</span>
              <input
                type="number"
                defaultValue={colorRule.hasta ?? ""}
                disabled={guardando}
                data-testid={`${prueba}-hasta-${i}`}
                onBlur={(e) =>
                  editar(i, { hasta: e.target.value === "" ? undefined : Number(e.target.value) })
                }
              />
              {/* Sin el otro extremo la regla no casa nunca, y se rechaza al guardar. */}
              <span className="campo__pista">Los dos extremos entran.</span>
            </label>
          ) : null}

          <div className="formulario__campo">
            <span>Color</span>
            <PaletaDeColores
              valor={colorRule.color}
              nombre={`la regla ${i + 1}`}
              prueba={`${prueba}-color-${i}`}
              onCambiar={(color) => editar(i, { color })}
            />
          </div>

          <div className="referencia__acciones">
            <button
              type="button"
              className="md-boton md-boton--texto"
              disabled={guardando || i === 0}
              data-testid={`${prueba}-subir-${i}`}
              onClick={() => mover(i, -1)}
            >
              Subir
            </button>
            <button
              type="button"
              className="md-boton md-boton--texto"
              disabled={guardando || i === rules.length - 1}
              data-testid={`${prueba}-bajar-${i}`}
              onClick={() => mover(i, 1)}
            >
              Bajar
            </button>
            <button
              type="button"
              className="md-boton md-boton--texto"
              disabled={guardando}
              data-testid={`${prueba}-quitar-${i}`}
              onClick={() => cambiar(rules.filter((_, j) => j !== i))}
            >
              Quitar
            </button>
          </div>
        </fieldset>
      ))}

      {rules.length < MAX_REGLAS ? (
        <button
          type="button"
          className="md-boton md-boton--contorno"
          disabled={guardando}
          data-testid={`${prueba}-anadir`}
          onClick={() => cambiar([...rules, { comparador: "mayor", valor: 0, color: "error" }])}
        >
          Anadir colorRule de color
        </button>
      ) : (
        <p className="campo__pista">
          Cinco es el maximo: mas rules dejan de ser excepciones y pasan a ser una scale, que es
          otra herramienta.
        </p>
      )}
    </>
  );
}
