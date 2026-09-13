"use client";

import { useId, useMemo, useState } from "react";
import type { QueryResult } from "@app/data-contracts";
import {
  selectoresEfectivos,
  toSlicerOptions,
  type NombreDeIcono,
  type ObjectInstance,
  type SelectorEfectivo,
} from "@app/ui-components";
import { useFiltrosDeUrl } from "../hooks/useFiltrosDeUrl";
import { Marco } from "./objetos";

/**
 * Panel de filtros — de 1 a 10 dimensiones en un solo objeto.
 *
 * Cada selector escribe en la URL, igual que hacia el segmentador: eso es lo que hace que un
 * panel con seis filtros puestos sea una direccion que se comparte, se marca y se recupera
 * (4.11). No hay estado local que sincronizar, y por eso el boton «atras» funciona.
 *
 * Los rangos de fecha viajan como DOS parametros, `campo.desde` y `campo.hasta`, y no como uno
 * solo con un separador. Un separador obliga a que quien lea la URL conozca el formato para
 * partirlo, y el dia que un valor contenga ese caracter el filtro se rompe en silencio.
 */

const DESDE = (campo: string) => `${campo}.desde`;
const HASTA = (campo: string) => `${campo}.hasta`;

export function PanelDeFiltros({
  titulo,
  instance,
  result,
  iconoDelObjeto,
}: {
  titulo: string;
  instance: ObjectInstance;
  result: QueryResult;
  /** El icono que declara la version del objeto en el catalogo. */
  iconoDelObjeto?: NombreDeIcono;
}) {
  const { valoresDe, alternar, limpiarCampo, fijar, searchParams } =
    useFiltrosDeUrl();

  // Los tipos salen de las columnas del propio resultado: es el mismo dato con el que se valido
  // en el servidor, asi que un selector de fecha aqui es un selector de fecha alli.
  const tiposPorCampo = useMemo(
    () => Object.fromEntries(result.columns.map((c) => [c.name, c.type])),
    [result.columns],
  );

  const selectores = useMemo(
    () =>
      selectoresEfectivos(
        instance,
        instance.configuracion?.objectId === "panel-de-filtros"
          ? instance.configuracion
          : undefined,
        tiposPorCampo,
      ),
    [instance, tiposPorCampo],
  );

  const puestos = selectores.filter((s) =>
    s.tipo === "calendario" || s.tipo === "rango-de-fechas"
      ? searchParams.has(DESDE(s.campo)) ||
        searchParams.has(HASTA(s.campo)) ||
        searchParams.has(s.campo)
      : valoresDe(s.campo).length > 0,
  ).length;

  return (
    <Marco
      titulo={titulo}
      instance={instance}
      result={result}
      {...(iconoDelObjeto ? { iconoDelObjeto } : {})}
      pie={
        puestos > 0 ? (
          <span
            className="texto-atenuado"
            data-testid={`panel-filtros-puestos-${instance.instanceId}`}
          >
            {puestos} de {selectores.length} filtros puestos
          </span>
        ) : null
      }
    >
      <div
        className="panel-filtros"
        data-testid={`panel-filtros-${instance.instanceId}`}
      >
        {selectores.map((selector) => (
          <SelectorDeCampo
            key={selector.campo}
            selector={selector}
            opciones={opcionesDe(result, selector.campo)}
            valores={valoresDe(selector.campo)}
            desde={searchParams.get(DESDE(selector.campo)) ?? ""}
            hasta={searchParams.get(HASTA(selector.campo)) ?? ""}
            onAlternar={(valor) => alternar(selector.campo, valor)}
            onFijar={(valor) => fijar(selector.campo, valor)}
            onFijarFecha={(cual, valor) =>
              fijar(
                cual === "desde"
                  ? DESDE(selector.campo)
                  : HASTA(selector.campo),
                valor,
              )
            }
            onLimpiar={() => {
              limpiarCampo(selector.campo);
              limpiarCampo(DESDE(selector.campo));
              limpiarCampo(HASTA(selector.campo));
            }}
          />
        ))}
      </div>
    </Marco>
  );
}

/** Valores distintos de una columna, ordenados. Salen del dataset YA recortado por el ambito. */
function opcionesDe(result: QueryResult, campo: string): string[] {
  const [tabla, ...resto] = campo.split(".");
  return toSlicerOptions(result, {
    table: tabla ?? "",
    field: resto.join("."),
  });
}

function SelectorDeCampo({
  selector,
  opciones,
  valores,
  desde,
  hasta,
  onAlternar,
  onFijar,
  onFijarFecha,
  onLimpiar,
}: {
  selector: SelectorEfectivo;
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
  const prueba = `filtro-${selector.campo}`;

  const filtradas = busqueda
    ? opciones.filter((o) => o.toLowerCase().includes(busqueda.toLowerCase()))
    : opciones;

  const hayAlgo = valores.length > 0 || desde !== "" || hasta !== "";

  return (
    <fieldset
      className="panel-filtros__campo"
      data-tipo={selector.tipo}
      data-testid={prueba}
    >
      <legend className="panel-filtros__etiqueta">
        {selector.etiqueta}
        {hayAlgo ? (
          <button
            type="button"
            className="boton-enlace panel-filtros__limpiar"
            data-testid={`${prueba}-limpiar`}
            onClick={onLimpiar}
          >
            Quitar
          </button>
        ) : null}
      </legend>

      {selector.tipo === "pastillas" ? (
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

      {selector.tipo === "lista" || selector.tipo === "busqueda" ? (
        <>
          {selector.tipo === "busqueda" ? (
            <input
              type="search"
              className="panel-filtros__buscar"
              // El campo BUSCA entre los valores; no es un filtro por si mismo. Sin esta
              // etiqueta, un lector de pantalla anuncia dos controles seguidos sin decir cual
              // reduce la lista y cual elige.
              aria-label={`Buscar en ${selector.etiqueta}`}
              placeholder="Buscar…"
              value={busqueda}
              data-testid={`${prueba}-buscar`}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          ) : null}
          <ul className="panel-filtros__lista">
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
              <li className="texto-atenuado">Ningun valor coincide.</li>
            ) : null}
          </ul>
        </>
      ) : null}

      {selector.tipo === "desplegable" ? (
        <select
          value={valores[0] ?? ""}
          // El `<legend>` nombra al `fieldset`, no a los controles de dentro. Axe lo pide en el
          // propio `<select>` y tiene razon: quien navega saltando de control en control llega
          // aqui sin haber pasado por la leyenda, y oye «lista, Penal» sin saber de que.
          aria-label={selector.etiqueta}
          data-testid={`${prueba}-desplegable`}
          onChange={(e) => onFijar(e.target.value)}
        >
          <option value="">(todos)</option>
          {opciones.map((opcion) => (
            <option key={opcion} value={opcion}>
              {opcion}
            </option>
          ))}
        </select>
      ) : null}

      {selector.tipo === "calendario" ? (
        <input
          type="date"
          value={valores[0] ?? ""}
          aria-label={selector.etiqueta}
          data-testid={`${prueba}-fecha`}
          onChange={(e) => onFijar(e.target.value)}
        />
      ) : null}

      {selector.tipo === "rango-de-fechas" ? (
        <div className="panel-filtros__rango">
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
