"use client";

import { useId, useMemo, useState } from "react";
import type { QueryResult } from "@app/data-contracts";
import {
  selectoresEfectivos,
  toSlicerOptions,
  type IconName,
  type ObjectInstance,
  type SelectorEfectivo,
} from "@app/ui-components";
import { useUrlFilters } from "../hooks/useUrlFilters";
import { Frame } from "./objects";

/** Panel de filtros — de 1 a 10 dimensiones en un solo objeto. */

const FROM = (fieldName: string) => `${fieldName}.desde`;
const HASTA = (fieldName: string) => `${fieldName}.hasta`;

export function FiltersPanel({
  titulo,
  instance,
  result,
  objectIcon,
}: {
  titulo: string;
  instance: ObjectInstance;
  result: QueryResult;
  /** El icono que declara la version del objeto en el catalogo. */
  objectIcon?: IconName;
}) {
  const { valuesOf, toggle, clearField, fijar, searchParams } =
    useUrlFilters();

  // Los tipos salen de las columnas del propio resultado: es el mismo dato con el que se valido
  // en el servidor, asi que un selector de fecha aqui es un selector de fecha alli.
  const fieldKinds = useMemo(
    () => Object.fromEntries(result.columns.map((c) => [c.name, c.type])),
    [result.columns],
  );

  const pickers = useMemo(
    () =>
      selectoresEfectivos(
        instance,
        instance.settings?.objectId === "panel-de-filtros"
          ? instance.settings
          : undefined,
        fieldKinds,
      ),
    [instance, fieldKinds],
  );

  const puestos = pickers.filter((s) =>
    s.tipo === "calendario" || s.tipo === "rango-de-fechas"
      ? searchParams.has(FROM(s.fieldName)) ||
        searchParams.has(HASTA(s.fieldName)) ||
        searchParams.has(s.fieldName)
      : valuesOf(s.fieldName).length > 0,
  ).length;

  return (
    <Frame
      titulo={titulo}
      instance={instance}
      result={result}
      {...(objectIcon ? { objectIcon } : {})}
      pie={
        puestos > 0 ? (
          <span
            className="muted-text"
            data-testid={`filters-panel-puestos-${instance.instanceId}`}
          >
            {puestos} de {pickers.length} filtros puestos
          </span>
        ) : null
      }
    >
      <div
        className="filters-panel"
        data-testid={`filters-panel-${instance.instanceId}`}
      >
        {pickers.map((picker) => (
          <FieldPicker
            key={picker.fieldName}
            picker={picker}
            opciones={optionsOf(result, picker.fieldName)}
            valores={valuesOf(picker.fieldName)}
            desde={searchParams.get(FROM(picker.fieldName)) ?? ""}
            hasta={searchParams.get(HASTA(picker.fieldName)) ?? ""}
            onAlternar={(valor) => toggle(picker.fieldName, valor)}
            onFijar={(valor) => fijar(picker.fieldName, valor)}
            onFijarFecha={(cual, valor) =>
              fijar(
                cual === "desde"
                  ? FROM(picker.fieldName)
                  : HASTA(picker.fieldName),
                valor,
              )
            }
            onLimpiar={() => {
              clearField(picker.fieldName);
              clearField(FROM(picker.fieldName));
              clearField(HASTA(picker.fieldName));
            }}
          />
        ))}
      </div>
    </Frame>
  );
}

/** Valores distintos de una columna, ordenados. Salen del dataset YA recortado por el ambito. */
function optionsOf(result: QueryResult, fieldName: string): string[] {
  const [tabla, ...resto] = fieldName.split(".");
  return toSlicerOptions(result, {
    table: tabla ?? "",
    field: resto.join("."),
  });
}

function FieldPicker({
  picker,
  opciones,
  valores,
  desde,
  hasta,
  onAlternar,
  onFijar,
  onFijarFecha,
  onLimpiar,
}: {
  picker: SelectorEfectivo;
  opciones: string[];
  valores: string[];
  desde: string;
  hasta: string;
  onAlternar: (valor: string) => void;
  onFijar: (valor: string) => void;
  onFijarFecha: (cual: "desde" | "hasta", valor: string) => void;
  onLimpiar: () => void;
}) {
  const id = useId();
  const [busqueda, setBusqueda] = useState("");
  const prueba = `filtro-${picker.fieldName}`;

  const filtradas = busqueda
    ? opciones.filter((o) => o.toLowerCase().includes(busqueda.toLowerCase()))
    : opciones;

  const hayAlgo = valores.length > 0 || desde !== "" || hasta !== "";

  return (
    <fieldset
      className="filters-panel__field"
      data-kind={picker.tipo}
      data-testid={prueba}
    >
      <legend className="filters-panel__label">
        {picker.etiqueta}
        {hayAlgo ? (
          <button
            type="button"
            className="boton-enlace filters-panel__clear"
            data-testid={`${prueba}-limpiar`}
            onClick={onLimpiar}
          >
            Quitar
          </button>
        ) : null}
      </legend>

      {picker.tipo === "pastillas" ? (
        <ul className="segmentador">
          {opciones.map((opcion) => (
            <li key={opcion}>
              <button
                type="button"
                className={`md-chip ${valores.includes(opcion) ? "md-chip--seleccionado" : ""}`}
                aria-pressed={valores.includes(opcion)}
                data-testid={`${prueba}-${opcion}`}
                onClick={() => onAlternar(opcion)}
              >
                {opcion}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {picker.tipo === "lista" || picker.tipo === "busqueda" ? (
        <>
          {picker.tipo === "busqueda" ? (
            <input
              type="search"
              className="filters-panel__search"
              // El campo BUSCA entre los valores; no es un filtro por si mismo. Sin esta
              // etiqueta, un lector de pantalla anuncia dos controles seguidos sin decir cual
              // reduce la lista y cual elige.
              aria-label={`Buscar en ${picker.etiqueta}`}
              placeholder="Buscar…"
              value={busqueda}
              data-testid={`${prueba}-buscar`}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          ) : null}
          <ul className="filters-panel__list">
            {filtradas.map((opcion) => (
              <li key={opcion}>
                <label>
                  <input
                    type="checkbox"
                    checked={valores.includes(opcion)}
                    data-testid={`${prueba}-${opcion}`}
                    onChange={() => onAlternar(opcion)}
                  />
                  {opcion}
                </label>
              </li>
            ))}
            {filtradas.length === 0 ? (
              <li className="muted-text">Ningun valor coincide.</li>
            ) : null}
          </ul>
        </>
      ) : null}

      {picker.tipo === "desplegable" ? (
        <select
          value={valores[0] ?? ""}
          // El `<legend>` nombra al `fieldset`, no a los controles de dentro. Axe lo pide en el
          // propio `<select>` y tiene razon: quien navega saltando de control en control llega
          // aqui sin haber pasado por la leyenda, y oye «lista, Penal» sin saber de que.
          aria-label={picker.etiqueta}
          data-testid={`${prueba}-desplegable`}
          onChange={(e) => onFijar(e.target.value)}
        >
          <option value="">(all)</option>
          {opciones.map((opcion) => (
            <option key={opcion} value={opcion}>
              {opcion}
            </option>
          ))}
        </select>
      ) : null}

      {picker.tipo === "calendario" ? (
        <input
          type="date"
          value={valores[0] ?? ""}
          aria-label={picker.etiqueta}
          data-testid={`${prueba}-fecha`}
          onChange={(e) => onFijar(e.target.value)}
        />
      ) : null}

      {picker.tipo === "rango-de-fechas" ? (
        <div className="filters-panel__range">
          <label htmlFor={`${id}-desde`}>Desde</label>
          <input
            id={`${id}-desde`}
            type="date"
            value={desde}
            // El «hasta» acota el «desde» y al reves: un rango invertido no devuelve nada y el
            // navegador lo puede impedir sin que haya que explicarlo.
            {...(hasta ? { max: hasta } : {})}
            data-testid={`${prueba}-desde`}
            onChange={(e) => onFijarFecha("desde", e.target.value)}
          />
          <label htmlFor={`${id}-hasta`}>Hasta</label>
          <input
            id={`${id}-hasta`}
            type="date"
            value={hasta}
            {...(desde ? { min: desde } : {})}
            data-testid={`${prueba}-hasta`}
            onChange={(e) => onFijarFecha("hasta", e.target.value)}
          />
        </div>
      ) : null}
    </fieldset>
  );
}
