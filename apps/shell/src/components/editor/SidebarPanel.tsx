"use client";

import { useEffect, useState } from "react";
import type { Aggregation } from "@app/data-contracts";
import { GRID_COLUMNS, type GridItem } from "@app/module-model";
import {
  ATTACHMENT_BY_DEFAULT,
  DATE_PICKERS,
  DEFAULT_AGGREGATION,
  PAGINATION_LEGENDS,
  PICKER_KINDS,
  filterableFields,
  possibleAggregations,
  slotFits,
  fieldKey,
  withSlotField,
  slotsOf,
  defaultSlots,
  slotFieldWithout,
  type AttachedObjectInstance,
  type AttachmentId,
  type DrillThroughTarget,
  type ObjectInstance,
  type FieldSlot,
  type PaginationLegend,
  type PickerKind,
} from "@app/ui-components";
import {
  type ObjectFamily,
  type ObjectCategory,
  type IconName,
  isContainer,
  isElement,
  placeable,
} from "@app/ui-components";
import type { PaletteDataset, PaletteObject } from "../../server/editor";
import { Icon } from "../icons/Icon";
import { EditorObjectSettings } from "./EditorObjectSettings";
import { Tabs, type TabDefinition } from "./Tabs";
import { Well } from "./Well";
import { Presentation } from "./Presentation";
import type { MessageKey } from "@app/i18n";
import { useTranslator } from "../Locale";
import { FilterProvider, Section } from "./Section";

/** El panel del editor: la tienda y el banco de trabajo, en uno. */

type Tab = "objetos" | "datos" | "formato" | "complementos";

export function SidebarPanel({
  objetos,
  datasets,
  iconos,
  modulos,
  selected,
  saving,
  onAnadir,
  onCambiar,
  onQuitar,
}: {
  objetos: PaletteObject[];
  datasets: PaletteDataset[];
  /** A donde puede apuntar un salto (4.4). Viene de la paleta, que la trae del servidor. */
  modulos: { slug: string; name: string }[];
  /** Los iconos que se pueden elegir hoy: el panel de administracion puede haber apagado alguno. */
  iconos: IconName[];
  selected: GridItem | null;
  saving: boolean;
  onAnadir: (objectId: string) => void;
  onCambiar: (itemId: string, change: (item: GridItem) => GridItem) => void;
  onQuitar: (itemId: string) => void;
}) {
  const t = useTranslator();
  const [pestana, setPestana] = useState<Tab>("objetos");
  const [filtro, setFiltro] = useState("");

  /*
   * Al elegir un objeto, el panel salta a «Datos».
   */
  const selectedId = selected?.id ?? null;
  const selectedObject = selected?.instance.objectId ?? null;
  useEffect(() => {
    if (!selectedId) {
      setPestana("objetos");
      return;
    }
    // Lo que no lee datos salta a «Formato»: es su primera pestana util, y mandarlo a una
    // deshabilitada dejaria el panel en blanco justo despues de colocar algo.
    const withoutData =
      selectedObject !== null &&
      (isElement(selectedObject) || isContainer(selectedObject));
    setPestana(withoutData ? "formato" : "datos");
  }, [selectedId, selectedObject]);

  const objectHas = selected !== null;
  const definicion = selected
    ? objetos.find((o) => o.objectId === selected.instance.objectId)
    : undefined;
  const dataset = selected
    ? datasets.find((d) => d.datasetId === selected.instance.binding.datasetId)
    : undefined;

  /*
   * «Datos» se deshabilita para lo que no consume datos.
   */
  const dataConsumes =
    (definicion?.dimensiones.max ?? 0) > 0 ||
    (definicion?.medidas.max ?? 0) > 0;

  const TABS: TabDefinition<Tab>[] = [
    {
      id: "objetos",
      etiqueta: t("editor.tab.objects"),
      icono: "barras",
      habilitada: true,
    },
    {
      id: "datos",
      etiqueta: t("editor.tab.data"),
      icono: "tabla",
      habilitada: objectHas && dataConsumes,
    },
    {
      id: "formato",
      etiqueta: t("editor.tab.format"),
      icono: "indicador",
      habilitada: objectHas,
    },
    {
      id: "complementos",
      etiqueta: t("editor.tab.addons"),
      icono: "informacion",
      habilitada: objectHas,
    },
  ];

  return (
    <aside className="editor-panel" data-testid="editor-panel">
      <Tabs tabs={TABS} activa={pestana} onElegir={setPestana} />

      <div
        className="editor-panel__body"
        role="tabpanel"
        id={`panel-${pestana}`}
        aria-labelledby={`pestana-${pestana}`}
        tabIndex={0}
      >
        {pestana === "objetos" ? (
          <Palette objetos={objetos} saving={saving} onAnadir={onAnadir} />
        ) : null}

        {pestana === "datos" && selected ? (
          <Data
            item={selected}
            definicion={definicion}
            datasets={datasets}
            modulos={modulos}
            saving={saving}
            onCambiar={onCambiar}
            onQuitar={onQuitar}
          />
        ) : null}

        {pestana === "formato" && selected ? (
          <div className="editor__format">
            {/*
              El buscador, PRIMERO y para la pestana ENTERA.

              La pestana llego a dieciocho secciones, y con esa cantidad la pregunta deja de ser
              «que opciones hay» y pasa a ser «donde esta la que quiero». Plegar no lo resuelve:
              plegado, encontrar algo obliga a abrir y cerrar una por una.

              Cubre las tres piezas de la pestana —la configuracion del objeto, la presentacion y
              el tamano— y no solo la del medio. Un buscador que dejara una seccion fuera seria
              peor que no tenerlo: quien no la encuentra concluye que no existe.

              No se guarda: el filtro es un gesto de un momento, no una preferencia.
            */}
            <label className="editor__search-box">
              <span className="editor__label-search-box">
                {t("panel.searchSetting")}
              </span>
              <input
                type="search"
                value={filtro}
                placeholder={t("panel.searchSetting.example")}
                data-testid="buscar-ajuste"
                onChange={(e) => setFiltro(e.target.value)}
              />
            </label>

            <FilterProvider filtro={filtro}>
              {/* `Presentacion` ya trae sus propias subsecciones: envolverlo en otra repetiria el
                rotulo «Presentacion» dos veces seguidas. */}
              <EditorObjectSettings
                instance={selected.instance}
                saving={saving}
                onCambiar={(change) =>
                  onCambiar(selected.id, (i) => ({
                    ...i,
                    instance: change(i.instance),
                  }))
                }
              />

              <Presentation
                iconos={iconos}
                instance={selected.instance}
                admitidas={definicion?.presentation ?? []}
                kinds={dataset?.kinds ?? {}}
                saving={saving}
                onCambiar={(change) =>
                  onCambiar(selected.id, (i) => ({
                    ...i,
                    instance: change(i.instance),
                  }))
                }
              />

              {/*
              El tamano y la posicion viven aqui, no en «Datos».
              Cuanto ocupa un objeto en la rejilla no cambia lo que mide: es como se ve.
            */}
              {/*
              Abierta por defecto: redimensionar es lo que mas se hace en esta pestana, y llegar a
              ella para encontrarse un titulo plegado anade un clic a cada ajuste.
            */}
              <Section
                titulo="Tamano y posicion"
                keys={[
                  "ancho",
                  "alto",
                  "columnas",
                  "filas",
                  "mover",
                  "rejilla",
                  "redimensionar",
                ]}
                prueba={`section-size-${selected.id}`}
              >
                <Size item={selected} saving={saving} onCambiar={onCambiar} />
              </Section>
            </FilterProvider>

            {/*
              Una busqueda sin resultados no puede dejar la pestana en blanco.
              Vacia se lee como «este objeto no tiene ajustes», que es falso, y ademas no da la
              salida. QUIEN decide si se ve es el CSS, con `:has()`: preguntarlo aqui obligaria a
              repetir la lista de que secciones admite cada objeto, y dos listas que hay que
              mantener iguales acaban desincronizandose.
            */}
            {filtro.trim() !== "" ? (
              <div className="editor__empty" data-testid="without-results">
                <p>Nada coincide con «{filtro.trim()}».</p>
                <button
                  type="button"
                  className="md-boton md-boton--texto"
                  data-testid="limpiar-busqueda"
                  onClick={() => setFiltro("")}
                >
                  {t("panel.seeSettings")}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {pestana === "complementos" && selected ? (
          <Addons
            item={selected}
            objetos={objetos}
            saving={saving}
            onCambiar={onCambiar}
          />
        ) : null}
      </div>
    </aside>
  );
}

/** La tienda: la unica puerta por la que entra un objeto al modulo. */
/** Que pregunta responde cada familia, dicho en una linea. */
/**
 * Las familias de la paleta, en el orden en que se ofrecen.
 *
 * El rotulo sale del catalogo de mensajes —`family.<id>`— y la linea que lo explica se queda
 * aqui hasta que se traduzca tambien. Que el orden viva en un array y no en el catalogo es
 * deliberado: es una decision de producto, no una cadena.
 */
const FAMILIES: { family: ObjectFamily; que: string }[] = [
  { family: "value", que: "El dato que hay que ver de un vistazo." },
  {
    family: "comparison",
    que: "Cuanto mide cada distrito, cada materia, cada tribunal.",
  },
  {
    family: "trend",
    que: "La trayectoria de una medida a lo largo de una dimension ordenada.",
  },
  {
    family: "proportion",
    que: "Que parte aporta cada categoria, y donde se pierde.",
  },
  {
    family: "relation",
    que: "Si dos cifras se mueven juntas, o cada una en su escala.",
  },
  { family: "detail", que: "Cuando hace falta la cifra exacta." },
  { family: "location", que: "La dimension geografica." },
  { family: "control", que: "No dibujan datos: eligen cuales se ven." },
];

/** Sin acentos y en minusculas, como el buscador del panel de formato y por lo mismo. */
const normalizar = (content: string): string =>
  content
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

function Palette({
  objetos,
  saving,
  onAnadir,
}: {
  objetos: PaletteObject[];
  saving: boolean;
  onAnadir: (objectId: string) => void;
}) {
  const t = useTranslator();
  // Los complementos se adjuntan a otro objeto, no se colocan en la rejilla. La validacion lo
  // rechaza, asi que tampoco se ofrecen aqui: tienen su propia pestana.
  // La regla de que se coloca vive en `placeable`, no aqui: un complemento se adjunta y un
  // navegador de pagina se elige en la configuracion del modulo, y los dos tienen que quedar
  // fuera de la paleta por el mismo sitio.
  const colocables = objetos.filter(placeable);
  const [busqueda, setBusqueda] = useState("");

  /*
   * Se busca por nombre Y por descripcion.
   */
  const filtro = normalizar(busqueda.trim());
  const coincide = (o: PaletteObject) =>
    filtro === "" ||
    normalizar(o.name).includes(filtro) ||
    normalizar(o.description).includes(filtro);

  const visibles = colocables.filter(coincide);
  const de = (...categories: ObjectCategory[]) =>
    visibles.filter((o) => categories.includes(o.category));
  const withData = de("grafico", "tabla", "indicador", "filtro", "mapa");

  return (
    <>
      <label className="editor__search-box">
        <span className="editor__label-search-box">
          {t("editor.searchObject")}
        </span>
        <input
          type="search"
          value={busqueda}
          placeholder={t("panel.searchObject.example")}
          data-testid="search-object"
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </label>

      {visibles.length === 0 ? (
        <div
          className="editor__empty editor__empty-visible"
          data-testid="without-objects"
        >
          <p>{t("editor.noObjects", { consulta: busqueda.trim() })}</p>
          <button
            type="button"
            className="md-boton md-boton--texto"
            data-testid="limpiar-busqueda-objeto"
            onClick={() => setBusqueda("")}
          >
            {t("panel.seeObjects")}
          </button>
        </div>
      ) : null}

      {withData.length > 0 ? (
        <Section titulo="Visualizaciones" prueba="visualization-section">
          <p className="muted-text editor-panel__nota">
            {t("panel.visualizations.help")}
          </p>

          {/*
            Agrupadas por la PREGUNTA que responden, no por tipo.
            Quince visualizaciones en una lista plana convierten elegir un objeto en recordar su
            nombre: «Grafico de columnas» y «Grafico de barras» solo se distinguen por el icono.
            Por pregunta se elige por lo que se quiere contar, que es como llega la necesidad.
          */}
          {/*
            Cada familia es una seccion COLAPSABLE, el mismo `<details>` del resto del panel.
            Ocho familias abiertas son una lista larga en un carril de 340 px; plegar las que no
            interesan deja a la vista las que si, sin que nada desaparezca por defecto — que el
            catalogo sea cerrado es justo el motivo por el que hay que poder verlo entero.

            El filtro del buscador se les pasa por el MISMO contexto que usa la pestana de
            Formato, y va aqui dentro y no envolviendo la tienda entera: fuera, «Visualizaciones»
            y «Elementos» desapareceran al buscar «barras», porque sus titulos no coinciden.
          */}
          <FilterProvider filtro={busqueda}>
            {FAMILIES.map(({ family, que }) => {
              const dela = withData.filter((o) => o.family === family);
              if (dela.length === 0) return null;
              return (
                <Section
                  key={family}
                  titulo={t(`family.${family}` as MessageKey)}
                  nivel={2}
                  prueba={`family-${family}`}
                  /*
                   * Las claves son los objetos que la familia contiene EN ESTA busqueda.
                   */
                  keys={dela.flatMap((o) => [o.name, o.description])}
                >
                  <p className="palette__family-where">{que}</p>
                  <ObjectList
                    objetos={dela}
                    prueba={`palette-${family}`}
                    withContract
                    saving={saving}
                    onAnadir={onAnadir}
                  />
                </Section>
              );
            })}
          </FilterProvider>
        </Section>
      ) : null}

      {de("elemento").length > 0 ? (
        <Section titulo="Elementos" prueba="element-section">
          <p className="muted-text editor-panel__nota">
            {t("panel.elements.help")}
          </p>
          <ObjectList
            objetos={de("elemento")}
            prueba="element-palette"
            saving={saving}
            onAnadir={onAnadir}
          />
        </Section>
      ) : null}

      {de("contenedor").length > 0 ? (
        <Section titulo="Contenedores" prueba="container-section">
          <p className="muted-text editor-panel__nota">
            {t("panel.containers.help")}
          </p>
          <ObjectList
            objetos={de("contenedor")}
            prueba="container-palette"
            saving={saving}
            onAnadir={onAnadir}
          />
        </Section>
      ) : null}
    </>
  );
}

function ObjectList({
  objetos,
  prueba,
  withContract = false,
  saving,
  onAnadir,
}: {
  objetos: PaletteObject[];
  prueba: string;
  /*
   * El contrato solo se ensena donde significa algo.
   */
  withContract?: boolean;
  saving: boolean;
  onAnadir: (objectId: string) => void;
}) {
  return (
    <ul className="tienda" data-testid={prueba}>
      {objetos.map((o) => (
        <li key={o.objectId}>
          <button
            type="button"
            className="palette__object"
            data-testid={`add-${o.objectId}`}
            disabled={saving}
            title={o.description}
            onClick={() => onAnadir(o.objectId)}
          >
            {/* El icono lo declara el OBJETO. Habia un mapa aqui y otro en la tarjeta, y publicar
                un objeto nuevo dejaba a los dos sin entrada. */}
            <Icon nombre={o.icono} tamano={22} />
            <span className="palette__name">{o.name}</span>
            {withContract ? (
              <span className="palette__contract">
                {o.dimensiones.min}–{o.dimensiones.max} dim · {o.medidas.min}–
                {o.medidas.max} med
              </span>
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Dataset y pozos de campos del objeto elegido. */
function Data({
  item,
  definicion,
  datasets,
  modulos,
  saving,
  onCambiar,
  onQuitar,
}: {
  item: GridItem;
  definicion: PaletteObject | undefined;
  datasets: PaletteDataset[];
  /** A donde puede apuntar un salto, de la paleta. */
  modulos: { slug: string; name: string }[];
  saving: boolean;
  onCambiar: (itemId: string, change: (item: GridItem) => GridItem) => void;
  onQuitar: (itemId: string) => void;
}) {
  const t = useTranslator();
  const dataset = datasets.find(
    (d) => d.datasetId === item.instance.binding.datasetId,
  );
  const instanceChange = (change: (i: ObjectInstance) => ObjectInstance) =>
    onCambiar(item.id, (it) => ({ ...it, instance: change(it.instance) }));

  const declared = definicion?.wells ?? [];
  const slots =
    declared.length > 0
      ? declared
      : defaultSlots({
          dimensions: definicion?.dimensiones ?? { min: 0, max: 0 },
          measures: definicion?.medidas ?? { min: 0, max: 0 },
        });

  const deDimension = slots.filter((r) => r.tipo === "dimension");
  const deMedida = slots.filter((r) => r.tipo === "medida");
  const assignment = slotsOf(item.instance, slots);

  /*
   * Poner y quitar van POR RANURA, no por indice.
   */
  const set = (slotId: string, fieldName: string) =>
    instanceChange((i) => withSlotField(i, slots, slotId, fieldName));

  const remove = (slotId: string, fieldName: string) =>
    instanceChange((i) => slotFieldWithout(i, slots, slotId, fieldName));

  /*
   * Como se resume cada medida.
   */
  const aggregationOf = (fieldName: string): Aggregation =>
    item.instance.binding.aggregations?.[fieldName] ??
    dataset?.aggregations[fieldName] ??
    DEFAULT_AGGREGATION;

  /*
   * Los operadores que el desplegable puede ofrecer, de la MISMA regla que valida al guardar.
   */
  const possible = possibleAggregations({
    colapsa: (dataset?.dimensiones ?? []).some(
      (d) => !item.instance.binding.dimensions.map(fieldKey).includes(d),
    ),
    dataGrain: dataset?.grain ?? "atomico",
  });

  const aggregationChange = (fieldName: string, aggregation: Aggregation) =>
    instanceChange((i) => {
      const resto = { ...(i.binding.aggregations ?? {}) };
      // Volver a la del esquema se guarda BORRANDO la anulacion, no copiando el mismo valor: si
      // se copiara, el modulo dejaria de seguir a la fuente sin que nadie lo hubiera pedido.
      if (
        aggregation ===
        (dataset?.aggregations[fieldName] ?? DEFAULT_AGGREGATION)
      ) {
        delete resto[fieldName];
      } else {
        resto[fieldName] = aggregation;
      }
      // Se reconstruye el binding SIN la clave, en vez de extenderlo: con un spread, quitar la
      // ultima anulacion habria dejado la del objeto anterior intacta — el `...i.binding` la
      // vuelve a traer y el `{ agregaciones }` condicional no llega a pisarla.
      const { aggregations: _previas, ...binding } = i.binding;
      const quedan = Object.keys(resto).length > 0;
      return {
        ...i,
        binding: quedan ? { ...binding, aggregations: resto } : binding,
      };
    });

  return (
    <>
      <Section titulo="Origen" prueba={`section-source-${item.id}`}>
        <label className="form__field">
          <span>{t("panel.title")}</span>
          <input
            defaultValue={item.instance.title}
            disabled={saving}
            data-testid={`title-${item.id}`}
            onBlur={(e) =>
              instanceChange((i) => ({ ...i, title: e.target.value }))
            }
          />
        </label>

        <label className="form__field">
          <span>{t("panel.dataset")}</span>
          <select
            value={item.instance.binding.datasetId}
            disabled={saving}
            data-testid={`dataset-${item.id}`}
            onChange={(e) =>
              instanceChange((i) => ({
                ...i,
                // Al cambiar de dataset se limpia el mapeo: los campos del anterior no existen en
                // el nuevo, y conservarlos dejaria el objeto roto sin que nadie hiciera nada mal.
                binding: {
                  datasetId: e.target.value,
                  dimensions: [],
                  measures: [],
                },
              }))
            }
          >
            {datasets.map((d) => (
              <option key={d.datasetId} value={d.datasetId}>
                {d.datasetId}
              </option>
            ))}
          </select>
        </label>
      </Section>

      {deDimension.length > 0 ? (
        <Section titulo="Campos" prueba={`section-fields-${item.id}`}>
          {deDimension.map((ranura) => (
            <EditSlot
              key={ranura.id}
              ranura={ranura}
              todas={slots}
              item={item}
              elegidos={assignment.get(ranura.id) ?? []}
              available={dataset?.dimensiones ?? []}
              saving={saving}
              onAnadir={set}
              onQuitar={remove}
            />
          ))}
        </Section>
      ) : null}

      {deMedida.length > 0 ? (
        <Section titulo="Cifras" prueba={`section-measures-${item.id}`}>
          {deMedida.map((ranura) => (
            <EditSlot
              key={ranura.id}
              ranura={ranura}
              todas={slots}
              item={item}
              elegidos={assignment.get(ranura.id) ?? []}
              available={dataset?.medidas ?? []}
              saving={saving}
              onAnadir={set}
              onQuitar={remove}
              aggregationOf={aggregationOf}
              onAgregacion={aggregationChange}
              possible={possible}
            />
          ))}
        </Section>
      ) : null}

      {/*
        A donde se salta desde este objeto.

        Vive en «Datos» y no en «Formato» porque un salto no es como se ve el objeto: es que
        contexto se lleva y a donde. Lo que viaja son los filtros que haya puestos al pulsarlo, y
        por eso no hay nada que declarar sobre «el valor que se pulso» — en esta aplicacion el
        estado visible ya vive en la URL.
      */}
      <Section
        titulo={t("drill.panel.title")}
        abierta={false}
        keys={["drill", "detalle", "ir a", "destino", "navegar"]}
        prueba={`section-drill-${item.id}`}
      >
        <DrillTargets
          item={item}
          modulos={modulos}
          saving={saving}
          onCambiar={instanceChange}
        />
      </Section>

      {/*
        Quitar es DESTRUCTIVO, y lo parecia menos que cualquier otra cosa del panel.
        Era un texto azul suelto al final de la columna, indistinguible de un rotulo. Lo que borra
        el trabajo de alguien tiene que verse como un boton y llevar el color de la advertencia,
        no esconderse en el peso visual mas bajo de la interfaz.
      */}
      <button
        type="button"
        className="danger-button editor-panel__remove"
        data-testid={`remove-${item.id}`}
        disabled={saving}
        onClick={() => onQuitar(item.id)}
      >
        <Icon nombre="close" tamano={14} />
        {t("panel.removeFromModule")}
      </button>
    </>
  );
}

/** Un `Pozo` atado a su ranura: traduce el callback generico a «esta ranura». */
function EditSlot({
  ranura,
  todas,
  item,
  elegidos,
  available,
  saving,
  onAnadir,
  onQuitar,
  aggregationOf,
  onAgregacion,
  possible,
}: {
  ranura: FieldSlot;
  /** TODAS las ranuras del objeto, no solo esta. */
  todas: FieldSlot[];
  item: GridItem;
  elegidos: string[];
  available: string[];
  saving: boolean;
  onAnadir: (slotId: string, fieldName: string) => void;
  onQuitar: (slotId: string, fieldName: string) => void;
  aggregationOf?: (fieldName: string) => Aggregation;
  onAgregacion?: (fieldName: string, aggregation: Aggregation) => void;
  possible?: Aggregation[];
}) {
  return (
    <Well
      well={ranura}
      prueba={`well-${item.id}-${ranura.id}`}
      elegidos={elegidos}
      available={available}
      // Solo `guardando`. Pasar aqui tambien «esta llena» apagaba los botones de QUITAR de la
      // propia ranura, asi que una ranura completa no se podia vaciar. El componente ya sabe si
      // esta llena y apaga solo lo que corresponde: el `+`.
      saving={saving}
      lleno={!slotFits(item.instance, todas, ranura.id)}
      onAnadir={(fieldName) => onAnadir(ranura.id, fieldName)}
      onQuitar={(fieldName) => onQuitar(ranura.id, fieldName)}
      {...(aggregationOf ? { aggregationOf } : {})}
      {...(onAgregacion ? { onAgregacion } : {})}
      {...(possible ? { possible } : {})}
    />
  );
}

/** Los objetos ADJUNTABLES del objeto elegido. */
function Addons({
  item,
  objetos,
  saving,
  onCambiar,
}: {
  item: GridItem;
  objetos: PaletteObject[];
  saving: boolean;
  onCambiar: (itemId: string, change: (item: GridItem) => GridItem) => void;
}) {
  const t = useTranslator();
  const adjuntables = objetos.filter((o) => o.attachable);
  const puestos = item.instance.attachments ?? [];

  const withAttachments = (siguientes: AttachedObjectInstance[]) =>
    onCambiar(item.id, (it) => ({
      ...it,
      instance: { ...it.instance, attachments: siguientes },
    }));

  /*
   * Como nace cada complemento lo dice el MODELO, no este panel.
   *
   * Antes eran dos ramas de un `if`, y un complemento nuevo caia en el `else` —naciendo como una
   * tabla de datos— sin que nada se quejara. `ATTACHMENT_BY_DEFAULT` es exhaustivo por tipo: un
   * complemento nuevo sin configuracion de partida no compila.
   */
  const add = (objectId: string, version: string) => {
    const nacer = ATTACHMENT_BY_DEFAULT[objectId as AttachmentId];
    if (!nacer) return;
    withAttachments([
      ...puestos,
      nacer({
        instanceId: `${objectId}-${item.id}`,
        version,
        host: item.instance,
      }),
    ]);
  };

  /** Reemplaza UN complemento, dejando el resto como estaba. */
  const cambiarUno = (
    instanceId: string,
    cambio: (a: AttachedObjectInstance) => AttachedObjectInstance,
  ) =>
    withAttachments(
      puestos.map((x) => (x.instanceId === instanceId ? cambio(x) : x)),
    );

  const remove = (instanceId: string) =>
    withAttachments(puestos.filter((a) => a.instanceId !== instanceId));

  return (
    <>
      <p className="muted-text editor-panel__nota">
        Acompanan a este objeto y no ocupan celda en la rejilla. Se dibujan como
        iconos en su pageHeader.
      </p>

      <Section titulo="Puestos" prueba={`section-addons-${item.id}`}>
        {puestos.length === 0 ? (
          <p className="muted-text" data-testid={`without-addons-${item.id}`}>
            {t("panel.noDataset")}
          </p>
        ) : (
          <ul className="editor-panel__attachments">
            {puestos.map((a) => (
              <li key={a.instanceId}>
                <Section
                  titulo={
                    objetos.find((o) => o.objectId === a.objectId)?.name ??
                    a.objectId
                  }
                  nivel={2}
                  prueba={`attachment-${item.id}-${a.objectId}`}
                >
                  <AttachmentSettings
                    item={item}
                    attachment={a}
                    saving={saving}
                    onCambiar={cambiarUno}
                  />

                  <button
                    type="button"
                    className="button-link"
                    disabled={saving}
                    data-testid={`remove-attachment-${item.id}-${a.objectId}`}
                    onClick={() => remove(a.instanceId)}
                  >
                    {t("action.remove")}
                  </button>
                </Section>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section titulo="Anadir" prueba={`section-add-addon-${item.id}`}>
        <ul className="tienda">
          {adjuntables.map((o) => {
            const yaPuesto = puestos.some((a) => a.objectId === o.objectId);
            return (
              <li key={o.objectId}>
                <button
                  type="button"
                  className="palette__object"
                  // Uno de cada tipo: dos tooltips sobre el mismo objeto se dibujarian uno encima
                  // del otro y no habria forma de saber cual se esta leyendo.
                  disabled={saving || yaPuesto}
                  title={o.description}
                  data-testid={`attach-${o.objectId}-${item.id}`}
                  onClick={() => add(o.objectId, o.version)}
                >
                  <Icon nombre={o.icono} tamano={22} />
                  <span className="palette__name">{o.name}</span>
                  <span className="palette__contract">
                    {yaPuesto ? "ya puesto" : "anadir"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Section>
    </>
  );
}

/**
 * La configuracion propia de CADA complemento.
 *
 * Un `switch` sobre la union discriminada y no un formulario generico: cada complemento pide cosas
 * distintas —un texto, un alcance, un campo, un tamano de pagina— y un formulario que las tratara
 * a todas igual acabaria ofreciendo «alcance» a un pie de pagina. El `default` no existe: si se
 * anade un complemento al modelo y no se le da pantalla aqui, TypeScript lo dice.
 */
function AttachmentSettings({
  item,
  attachment,
  saving,
  onCambiar,
}: {
  item: GridItem;
  attachment: AttachedObjectInstance;
  saving: boolean;
  onCambiar: (
    instanceId: string,
    cambio: (a: AttachedObjectInstance) => AttachedObjectInstance,
  ) => void;
}) {
  const t = useTranslator();
  const cambiar = (
    cambio: (a: AttachedObjectInstance) => AttachedObjectInstance,
  ) => onCambiar(attachment.instanceId, cambio);

  switch (attachment.objectId) {
    case "tooltip-explicativo":
      return (
        <label className="form__field">
          <span>{t("panel.text")}</span>
          <textarea
            rows={3}
            defaultValue={attachment.text}
            disabled={saving}
            data-testid={`text-${item.id}`}
            onBlur={(e) =>
              cambiar((x) =>
                x.objectId === "tooltip-explicativo"
                  ? { ...x, text: e.target.value }
                  : x,
              )
            }
          />
        </label>
      );

    case "tabla-de-datos":
      return (
        <label className="form__field">
          <span>{t("panel.extent")}</span>
          <select
            value={attachment.scope}
            disabled={saving}
            data-testid={`reach-${item.id}`}
            onChange={(e) =>
              cambiar((x) =>
                x.objectId === "tabla-de-datos"
                  ? { ...x, scope: e.target.value as "objeto" | "subobjeto" }
                  : x,
              )
            }
          >
            <option value="objeto">{t("panel.extent.object")}</option>
            <option value="subobjeto">{t("panel.extent.category")}</option>
          </select>
        </label>
      );

    case "filtro-de-visualizacion": {
      // Solo lo que el objeto YA mapea: un campo cualquiera del dataset convertiria el
      // complemento en un filtro general disfrazado, y la validacion lo rechaza.
      const campos = filterableFields(item.instance);
      return (
        <>
          <label className="form__field">
            <span>{t("panel.addon.field")}</span>
            <select
              value={attachment.fieldName}
              disabled={saving || campos.length === 0}
              data-testid={`filter-field-${item.id}`}
              onChange={(e) =>
                cambiar((x) =>
                  x.objectId === "filtro-de-visualizacion"
                    ? { ...x, fieldName: e.target.value }
                    : x,
                )
              }
            >
              {campos.map((campo) => (
                <option key={campo} value={campo}>
                  {campo}
                </option>
              ))}
            </select>
          </label>
          <label className="form__field">
            <span>{t("panel.addon.picker")}</span>
            <select
              value={attachment.tipo ?? ""}
              disabled={saving}
              data-testid={`filter-kind-${item.id}`}
              onChange={(e) =>
                cambiar((x) =>
                  x.objectId === "filtro-de-visualizacion"
                    ? e.target.value === ""
                      ? (({ tipo: _quitado, ...resto }) => resto)(x)
                      : { ...x, tipo: e.target.value as PickerKind }
                    : x,
                )
              }
            >
              <option value="">{t("panel.addon.picker.auto")}</option>
              {/* Los de fecha NO se ofrecen: este complemento compara por valor, y la validacion
                  los rechaza. Ofrecerlos seria ofrecer un control que no acota nada. */}
              {PICKER_KINDS.filter((k) => !DATE_PICKERS.includes(k)).map(
                (kind) => (
                  <option key={kind} value={kind}>
                    {kind}
                  </option>
                ),
              )}
            </select>
          </label>
        </>
      );
    }

    case "pie-de-pagina":
      return (
        <>
          <label className="form__field">
            <span>{t("panel.addon.footer")}</span>
            <textarea
              rows={2}
              defaultValue={attachment.texto}
              disabled={saving}
              data-testid={`footer-text-${item.id}`}
              onBlur={(e) =>
                cambiar((x) =>
                  x.objectId === "pie-de-pagina"
                    ? { ...x, texto: e.target.value }
                    : x,
                )
              }
            />
          </label>
          <p className="muted-text editor-panel__nota">
            {t("panel.addon.footer.help")}
            {item.instance.binding.measures
              .map((m, i) => ` {{${i + 1}}} = ${m}.`)
              .join("")}
          </p>
        </>
      );

    case "paginado":
      return (
        <>
          <label className="form__field">
            <span>{t("panel.addon.perPage")}</span>
            <input
              type="number"
              min={1}
              step={1}
              value={attachment.porPagina}
              disabled={saving}
              data-testid={`per-page-${item.id}`}
              onChange={(e) =>
                cambiar((x) =>
                  x.objectId === "paginado"
                    ? { ...x, porPagina: Number(e.target.value) }
                    : x,
                )
              }
            />
          </label>
          <label className="form__check">
            <input
              type="checkbox"
              checked={attachment.selector !== false}
              disabled={saving}
              data-testid={`page-selector-${item.id}`}
              onChange={(e) =>
                cambiar((x) =>
                  x.objectId === "paginado"
                    ? { ...x, selector: e.target.checked }
                    : x,
                )
              }
            />
            <span>{t("panel.addon.pageSelector")}</span>
          </label>
          <label className="form__field">
            <span>{t("panel.addon.legend")}</span>
            <select
              value={attachment.coletilla ?? "ninguna"}
              disabled={saving}
              data-testid={`legend-${item.id}`}
              onChange={(e) =>
                cambiar((x) =>
                  x.objectId === "paginado"
                    ? { ...x, coletilla: e.target.value as PaginationLegend }
                    : x,
                )
              }
            >
              {PAGINATION_LEGENDS.map((donde) => (
                <option key={donde} value={donde}>
                  {t(`panel.addon.legend.${donde}`)}
                </option>
              ))}
            </select>
          </label>
        </>
      );
  }
}

/** Tamano y posicion, con numeros y con botones. */
function Size({
  item,
  saving,
  onCambiar,
}: {
  item: GridItem;
  saving: boolean;
  onCambiar: (itemId: string, change: (item: GridItem) => GridItem) => void;
}) {
  const mover = (dx: number, dw: number) =>
    onCambiar(item.id, (it) => {
      // Se recorta contra los bordes aqui y no se deja que lo rechace la validacion: un boton que
      // guarda algo invalido y luego muestra un error hace trabajar a quien edita para descubrir
      // un limite que el editor ya conoce.
      const w = Math.min(GRID_COLUMNS, Math.max(1, it.position.w + dw));
      const x = Math.min(GRID_COLUMNS - w, Math.max(0, it.position.x + dx));
      return { ...it, position: { ...it.position, x, w } };
    });

  const alto = (dh: number) =>
    onCambiar(item.id, (it) => ({
      ...it,
      position: { ...it.position, h: Math.max(1, it.position.h + dh) },
    }));

  const borderThe = item.position.x + item.position.w >= GRID_COLUMNS;

  return (
    <>
      <p
        className="muted-text editor-panel__nota"
        data-testid={`position-${item.id}`}
      >
        Columna {item.position.x + 1}–{item.position.x + item.position.w} de{" "}
        {GRID_COLUMNS} · {item.position.h}{" "}
        {item.position.h === 1 ? "fila" : "filas"}
      </p>
      <div className="editor-panel__pasos">
        <Paso
          etiqueta="Menos ancho"
          prueba={`narrow-${item.id}`}
          desactivado={saving || item.position.w <= 1}
          onPulsar={() => mover(0, -1)}
        />
        <Paso
          etiqueta="Mas ancho"
          prueba={`widen-${item.id}`}
          desactivado={saving || borderThe}
          onPulsar={() => mover(0, 1)}
        />
        <Paso
          etiqueta="Mover a la izquierda"
          prueba={`left-${item.id}`}
          desactivado={saving || item.position.x <= 0}
          onPulsar={() => mover(-1, 0)}
        />
        <Paso
          etiqueta="Mover a la derecha"
          prueba={`right-${item.id}`}
          desactivado={saving || borderThe}
          onPulsar={() => mover(1, 0)}
        />
        <Paso
          etiqueta="Menos alto"
          prueba={`down-${item.id}`}
          desactivado={saving || item.position.h <= 1}
          onPulsar={() => alto(-1)}
        />
        <Paso
          etiqueta="Mas alto"
          prueba={`up-${item.id}`}
          desactivado={saving}
          onPulsar={() => alto(1)}
        />
      </div>
    </>
  );
}

function Paso({
  etiqueta,
  prueba,
  desactivado,
  onPulsar,
}: {
  etiqueta: string;
  prueba: string;
  desactivado: boolean;
  onPulsar: () => void;
}) {
  return (
    <button
      type="button"
      className="md-chip"
      data-testid={prueba}
      disabled={desactivado}
      onClick={onPulsar}
    >
      {etiqueta}
    </button>
  );
}

/**
 * A donde salta este objeto — drill-through de 4.4.
 *
 * Lo que se declara es el DESTINO, no quien puede seguirlo: el salto lo sigue otra persona, con su
 * propio ambito, y quien decide si se le ofrece es el camino de lectura cuando abra el modulo.
 * Filtrar aqui por lo que alcanza quien edita daria una lista distinta para cada persona que
 * configure el mismo modulo.
 *
 * El rotulo es opcional y cae al nombre del modulo: «Ir a Audiencias» dice mas que «Ir al
 * destino», y ahorra rellenar un campo para que el menu se lea.
 */
function DrillTargets({
  item,
  modulos,
  saving,
  onCambiar,
}: {
  item: GridItem;
  modulos: { slug: string; name: string }[];
  saving: boolean;
  onCambiar: (change: (i: ObjectInstance) => ObjectInstance) => void;
}) {
  const t = useTranslator();
  const destinos = item.instance.drillThrough ?? [];

  const escribir = (siguientes: DrillThroughTarget[]) =>
    onCambiar((i) => {
      // Vacio se QUITA en vez de guardarse como lista vacia: un objeto sin saltos y uno con una
      // lista de cero saltos son lo mismo, y guardar los dos deja dos formas de decir nada.
      const { drillThrough: _fuera, ...resto } = i;
      return siguientes.length > 0
        ? { ...resto, drillThrough: siguientes }
        : resto;
    });

  const cambiar = (indice: number, parcial: Partial<DrillThroughTarget>) =>
    escribir(destinos.map((d, i) => (i === indice ? { ...d, ...parcial } : d)));

  return (
    <>
      {destinos.length === 0 ? (
        <p className="muted-text" data-testid={`drill-empty-${item.id}`}>
          {t("drill.panel.empty")}
        </p>
      ) : null}

      <ol className="editor__saltos">
        {destinos.map((destino, indice) => {
          // Extraido a una constante y no escrito en linea: la guarda del catalogo cuenta el texto
          // suelto de un JSX con una expresion regular, y una condicion en linea le parece prosa.
          const destinoSigueEnLaLista = modulos.some(
            (m) => m.slug === destino.moduleSlug,
          );
          return (
            // Por indice y no por slug: dos saltos al mismo modulo con distinta pagina son
            // legitimos, y con el slug de clave React los trataria como uno.
            <li
              key={`${destino.moduleSlug}-${indice}`}
              data-testid={`drill-${item.id}-${indice}`}
            >
              <label className="form__field">
                <span>{t("drill.panel.module")}</span>
                <select
                  value={destino.moduleSlug}
                  disabled={saving}
                  data-testid={`drill-modulo-${item.id}-${indice}`}
                  onChange={(e) =>
                    cambiar(indice, { moduleSlug: e.target.value })
                  }
                >
                  {/*
                  Un modulo que ya no existe se queda en la lista como opcion suya.
                  Sin esto, el desplegable ensenaria el primero de la lista y quien abriera el panel
                  creeria que el salto apunta ahi: el aviso de `drillProblems` diria que el destino
                  no existe y el control estaria diciendo que si.
                */}
                  {destinoSigueEnLaLista ? null : (
                    <option value={destino.moduleSlug}>
                      {t("drill.panel.gone", { slug: destino.moduleSlug })}
                    </option>
                  )}
                  {modulos.map((m) => (
                    <option key={m.slug} value={m.slug}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form__field">
                <span>{t("drill.panel.label")}</span>
                <input
                  type="text"
                  value={destino.label ?? ""}
                  placeholder={
                    modulos.find((m) => m.slug === destino.moduleSlug)?.name ??
                    t("drill.action")
                  }
                  disabled={saving}
                  data-testid={`drill-rotulo-${item.id}-${indice}`}
                  onChange={(e) => {
                    const texto = e.target.value.trim();
                    cambiar(
                      indice,
                      texto === ""
                        ? { label: undefined }
                        : { label: e.target.value },
                    );
                  }}
                />
              </label>

              <button
                type="button"
                className="button-link"
                disabled={saving}
                data-testid={`drill-quitar-${item.id}-${indice}`}
                onClick={() =>
                  escribir(destinos.filter((_, i) => i !== indice))
                }
              >
                {t("drill.panel.remove")}
              </button>
            </li>
          );
        })}
      </ol>

      <button
        type="button"
        className="pastilla"
        disabled={saving || modulos.length === 0}
        data-testid={`drill-anadir-${item.id}`}
        onClick={() => {
          const primero = modulos[0];
          if (primero) escribir([...destinos, { moduleSlug: primero.slug }]);
        }}
      >
        {t("drill.panel.add")}
      </button>
    </>
  );
}
