"use client";

import { useId, useMemo, useState } from "react";
import type { QueryResult } from "@app/data-contracts";
import {
  effectivePickers,
  orderedValues,
  type FilterMode,
  type IconName,
  type ObjectInstance,
  type SelectorEfectivo,
  type ValueCount,
} from "@app/ui-components";
import { useUrlFilters } from "../hooks/useUrlFilters";
import {
  SIN_NADA,
  escribirEstado,
  estadoDe,
  sinNada,
  valueStats,
  type EstadoDeCampo,
} from "./fieldFilterState";
import { Frame } from "./objects";
import { useTranslator } from "./Locale";
import type { MessageKey } from "@app/i18n";
import { Icon } from "./icons/Icon";

/** Panel de filtros — de 1 a 10 dimensiones en un solo objeto. */

/** Como se rotula cada forma de acotar. El texto sale del catalogo, no de aqui. */
const MODO: Record<FilterMode, MessageKey> = {
  valores: "filters.mode.valores",
  excluir: "filters.mode.excluir",
  texto: "filters.mode.texto",
  rango: "filters.mode.rango",
  vacios: "filters.mode.vacios",
};

/** El modo con el que abrir: el que YA esta puesto, para que un enlace compartido no mienta. */
function modoInicial(estado: EstadoDeCampo, modos: FilterMode[]): FilterMode {
  const puesto: FilterMode | undefined =
    estado.excluye.length > 0
      ? "excluir"
      : estado.contiene !== undefined || estado.empieza !== undefined
        ? "texto"
        : estado.desde !== undefined || estado.hasta !== undefined
          ? "rango"
          : estado.vacio !== undefined
            ? "vacios"
            : estado.incluye.length > 0
              ? "valores"
              : undefined;

  if (puesto && modos.includes(puesto)) return puesto;
  return modos[0] ?? "valores";
}

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
  const { searchParams, aplicar } = useUrlFilters();

  // Los tipos salen de las columnas del propio resultado: es el mismo dato con el que se valido
  // en el servidor, asi que un selector de fecha aqui es un selector de fecha alli.
  const fieldKinds = useMemo(
    () => Object.fromEntries(result.columns.map((c) => [c.name, c.type])),
    [result.columns],
  );

  const pickers = useMemo(
    () =>
      effectivePickers(
        instance,
        instance.settings?.objectId === "panel-de-filtros"
          ? instance.settings
          : undefined,
        fieldKinds,
      ),
    [instance, fieldKinds],
  );

  const query = searchParams.toString();
  const estados = useMemo(() => {
    const params = new URLSearchParams(query);
    return new Map(
      pickers.map((p) => [p.fieldName, estadoDe(params, p.fieldName)] as const),
    );
  }, [pickers, query]);

  const puestos = pickers.filter(
    (p) => !sinNada(estados.get(p.fieldName) ?? SIN_NADA),
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
            valores={valueStats(result, picker.fieldName)}
            estado={estados.get(picker.fieldName) ?? SIN_NADA}
            onCambiar={(siguiente) =>
              aplicar((params) =>
                escribirEstado(params, picker.fieldName, siguiente),
              )
            }
          />
        ))}
      </div>
    </Frame>
  );
}

/*
 * Se EXPORTA porque el navegador lateral y el complemento de filtro de visualizacion lo dibujan,
 * no una copia.
 *
 * «Bajo el mismo metodo que los filtros ordinarios» no es una frase sobre la configuracion: si
 * cada sitio tuviera sus controles, un «contiene» se comportaria distinto segun donde estuviera, y
 * nadie lo habria decidido.
 */
export function FieldPicker({
  picker,
  valores,
  estado,
  onCambiar,
}: {
  picker: SelectorEfectivo;
  /** Los valores del campo con su recuento, sin ordenar: el orden lo decide el selector. */
  valores: ValueCount[];
  estado: EstadoDeCampo;
  onCambiar: (estado: EstadoDeCampo) => void;
}) {
  const t = useTranslator();
  const id = useId();
  const [busqueda, setBusqueda] = useState("");
  const [modo, setModo] = useState<FilterMode>(() =>
    modoInicial(estado, picker.modos),
  );
  const [abierto, setAbierto] = useState(!picker.plegado);
  const prueba = `filter-${picker.fieldName}`;

  const ordenadas = useMemo(
    () => orderedValues(valores, picker.orden),
    [valores, picker.orden],
  );
  const filtradas = busqueda
    ? ordenadas.filter((o) =>
        o.valor.toLowerCase().includes(busqueda.toLowerCase()),
      )
    : ordenadas;

  const puesto = !sinNada(estado);
  const elegidos = modo === "excluir" ? estado.excluye : estado.incluye;
  const conValores = (siguientes: string[]) =>
    onCambiar(
      modo === "excluir"
        ? { ...SIN_NADA, excluye: siguientes }
        : { ...SIN_NADA, incluye: siguientes },
    );
  const alternar = (valor: string) =>
    conValores(
      elegidos.includes(valor)
        ? elegidos.filter((v) => v !== valor)
        : [...elegidos, valor],
    );

  const rotulo = (v: ValueCount) =>
    picker.recuento ? `${v.valor} (${v.recuento})` : v.valor;

  return (
    <fieldset
      className="filters-panel__field"
      data-kind={picker.tipo}
      data-modo={modo}
      data-abierto={abierto ? "si" : "no"}
      data-testid={prueba}
    >
      <legend className="filters-panel__label">
        {/*
          El nombre del campo PLIEGA su seccion, y solo cuando se configuro plegable.
          Un panel de diez campos abiertos no se lee de un vistazo; uno de dos, plegado, esconde
          lo unico que tenia. Por eso se elige por campo y no se impone.
        */}
        {picker.plegado ? (
          <button
            type="button"
            className="button-link filters-panel__plegar"
            aria-expanded={abierto}
            data-testid={`${prueba}-plegar`}
            onClick={() => setAbierto((v) => !v)}
          >
            <Icon nombre="expandir" tamano={14} />
            {picker.etiqueta}
          </button>
        ) : (
          picker.etiqueta
        )}
        {puesto ? (
          <button
            type="button"
            className="button-link filters-panel__clear"
            data-testid={`${prueba}-limpiar`}
            onClick={() => onCambiar(SIN_NADA)}
          >
            {t("action.remove")}
          </button>
        ) : null}
      </legend>

      {abierto ? (
        <>
          {/*
            La forma de acotar se elige por campo, y solo si hay mas de una.
            Con una sola, el desplegable seria un control que nunca cambia nada — ruido con aspecto
            de opcion.
          */}
          {picker.modos.length > 1 ? (
            <label className="filters-panel__modo">
              <span className="visualmente-oculto">
                Como filtrar {picker.etiqueta}
              </span>
              <select
                value={modo}
                data-testid={`${prueba}-modo`}
                onChange={(e) => {
                  // Cambiar de forma LIMPIA lo anterior: «es Penal» y «no es Penal» a la vez no
                  // devuelve nada, y quien cambio de modo no pidio eso.
                  setModo(e.target.value as FilterMode);
                  if (puesto) onCambiar(SIN_NADA);
                }}
              >
                {picker.modos.map((m) => (
                  <option key={m} value={m}>
                    {t(MODO[m])}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {modo === "valores" || modo === "excluir" ? (
            <>
              {picker.todos ? (
                <div className="filters-panel__todos">
                  <button
                    type="button"
                    className="button-link"
                    data-testid={`${prueba}-todos`}
                    onClick={() => conValores(filtradas.map((v) => v.valor))}
                  >
                    {t("filters.all")}
                  </button>
                  <button
                    type="button"
                    className="button-link"
                    data-testid={`${prueba}-ninguno`}
                    onClick={() => conValores([])}
                  >
                    {t("filters.none")}
                  </button>
                </div>
              ) : null}

              {picker.tipo === "pastillas" ? (
                <ul className="segmentador">
                  {ordenadas.map((opcion) => (
                    <li key={opcion.valor}>
                      <button
                        type="button"
                        className={`md-chip ${elegidos.includes(opcion.valor) ? "md-chip--seleccionado" : ""}`}
                        aria-pressed={elegidos.includes(opcion.valor)}
                        data-testid={`${prueba}-${opcion.valor}`}
                        onClick={() => alternar(opcion.valor)}
                      >
                        {rotulo(opcion)}
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
                      // etiqueta, un lector de pantalla anuncia dos controles seguidos sin decir
                      // cual reduce la lista y cual elige.
                      aria-label={`Buscar en ${picker.etiqueta}`}
                      placeholder={t("filters.searchPlaceholder")}
                      value={busqueda}
                      data-testid={`${prueba}-buscar`}
                      onChange={(e) => setBusqueda(e.target.value)}
                    />
                  ) : null}
                  <ul className="filters-panel__list">
                    {filtradas.map((opcion) => (
                      <li key={opcion.valor}>
                        <label>
                          <input
                            type="checkbox"
                            checked={elegidos.includes(opcion.valor)}
                            data-testid={`${prueba}-${opcion.valor}`}
                            onChange={() => alternar(opcion.valor)}
                          />
                          {rotulo(opcion)}
                        </label>
                      </li>
                    ))}
                    {filtradas.length === 0 ? (
                      <li className="muted-text">{t("filters.noMatch")}</li>
                    ) : null}
                  </ul>
                </>
              ) : null}

              {picker.tipo === "desplegable" ? (
                <select
                  value={elegidos[0] ?? ""}
                  // El `<legend>` nombra al `fieldset`, no a los controles de dentro. Axe lo pide
                  // en el propio `<select>` y tiene razon: quien navega saltando de control en
                  // control llega aqui sin haber pasado por la leyenda.
                  aria-label={picker.etiqueta}
                  data-testid={`${prueba}-desplegable`}
                  onChange={(e) =>
                    conValores(e.target.value === "" ? [] : [e.target.value])
                  }
                >
                  <option value="">{t("filters.any")}</option>
                  {ordenadas.map((opcion) => (
                    <option key={opcion.valor} value={opcion.valor}>
                      {rotulo(opcion)}
                    </option>
                  ))}
                </select>
              ) : null}

              {picker.tipo === "calendario" ? (
                <input
                  type="date"
                  value={elegidos[0] ?? ""}
                  aria-label={picker.etiqueta}
                  data-testid={`${prueba}-fecha`}
                  onChange={(e) =>
                    conValores(e.target.value === "" ? [] : [e.target.value])
                  }
                />
              ) : null}

              {picker.tipo === "rango-de-fechas" ? (
                <Rango
                  id={id}
                  prueba={prueba}
                  estado={estado}
                  fecha
                  onCambiar={onCambiar}
                />
              ) : null}
            </>
          ) : null}

          {modo === "texto" ? (
            <div className="filters-panel__texto">
              <label htmlFor={`${id}-contiene`}>{t("filters.contains")}</label>
              <input
                id={`${id}-contiene`}
                type="search"
                defaultValue={estado.contiene ?? ""}
                data-testid={`${prueba}-contiene`}
                // Al SALIR del campo y no en cada tecla: cada cambio reescribe la URL y vuelve a
                // dibujar la pagina, y escribiendo «civil» eso son cinco vueltas para una busqueda.
                onBlur={(e) =>
                  onCambiar(
                    e.target.value
                      ? { ...SIN_NADA, contiene: e.target.value }
                      : SIN_NADA,
                  )
                }
              />
              <label htmlFor={`${id}-empieza`}>{t("filters.startsWith")}</label>
              <input
                id={`${id}-empieza`}
                type="search"
                defaultValue={estado.empieza ?? ""}
                data-testid={`${prueba}-empieza`}
                onBlur={(e) =>
                  onCambiar(
                    e.target.value
                      ? { ...SIN_NADA, empieza: e.target.value }
                      : SIN_NADA,
                  )
                }
              />
            </div>
          ) : null}

          {modo === "rango" ? (
            <Rango
              id={id}
              prueba={prueba}
              estado={estado}
              fecha={picker.tipo === "rango-de-fechas" || picker.tipo === "calendario"}
              onCambiar={onCambiar}
            />
          ) : null}

          {modo === "vacios" ? (
            <label className="filters-panel__vacios">
              <span className="visualmente-oculto">
                Valores de {picker.etiqueta}
              </span>
              <select
                value={estado.vacio === undefined ? "" : estado.vacio ? "si" : "no"}
                data-testid={`${prueba}-vacios`}
                onChange={(e) =>
                  onCambiar(
                    e.target.value === ""
                      ? SIN_NADA
                      : { ...SIN_NADA, vacio: e.target.value === "si" },
                  )
                }
              >
                <option value="">{t("filters.any")}</option>
                <option value="no">{t("filters.onlyWithValue")}</option>
                <option value="si">{t("filters.onlyWithoutValue")}</option>
              </select>
            </label>
          ) : null}
        </>
      ) : null}
    </fieldset>
  );
}

/** Desde y hasta, para numeros o para fechas. */
function Rango({
  id,
  prueba,
  estado,
  fecha,
  onCambiar,
}: {
  id: string;
  prueba: string;
  estado: EstadoDeCampo;
  fecha: boolean;
  onCambiar: (estado: EstadoDeCampo) => void;
}) {
  const t = useTranslator();
  const tipo = fecha ? "date" : "number";
  const desde = estado.desde ?? "";
  const hasta = estado.hasta ?? "";
  const conRango = (cual: "desde" | "hasta", valor: string) => {
    const siguiente: EstadoDeCampo = { ...SIN_NADA, desde, hasta };
    siguiente[cual] = valor;
    if (!siguiente.desde) delete siguiente.desde;
    if (!siguiente.hasta) delete siguiente.hasta;
    onCambiar(siguiente);
  };

  return (
    <div className="filters-panel__range">
      <label htmlFor={`${id}-desde`}>{t("filters.from")}</label>
      <input
        id={`${id}-desde`}
        type={tipo}
        value={desde}
        // El «hasta» acota el «desde» y al reves: un rango invertido no devuelve nada y el
        // navegador lo puede impedir sin que haya que explicarlo.
        {...(hasta ? { max: hasta } : {})}
        data-testid={`${prueba}-desde`}
        onChange={(e) => conRango("desde", e.target.value)}
      />
      <label htmlFor={`${id}-hasta`}>{t("filters.to")}</label>
      <input
        id={`${id}-hasta`}
        type={tipo}
        value={hasta}
        {...(desde ? { min: desde } : {})}
        data-testid={`${prueba}-hasta`}
        onChange={(e) => conRango("hasta", e.target.value)}
      />
    </div>
  );
}
