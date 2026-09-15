"use client";

import {
  ACCENTS,
  FUNNEL_COMPARISONS,
  CIRCULAR_LABELS,
  MAX_RADIO_INTERIOR,
  STACKING_MODES,
  LEGEND_MODES,
  type SortCriterion,
  type FunnelComparison,
  type PieLabel,
  type StackingMode,
  DATUM_POSITIONS,
  LABEL_POSITIONS,
  normalizedLabels,
  FORMAT_KINDS,
  AXIS_SCALES,
  PICKER_KINDS,
  PICKER_LEVELS,
  VALUE_ORDERS,
  patternProblem,
  defaultPicker,
  effectivePickers,
  modesByDefault,
  type ObjectAccent,
  type PresentationKey,
  type TextTarget,
  type TextStyle,
  type NumberFormat,
  type ObjectFormats,
  type LegendMode,
  type DatumPosition,
  type LabelPosition,
  type FormatKind,
  type ObjectInstance,
  type IconName,
  type ObjectPresentation,
  type PickerKind,
  type PickerLevel,
  type AxisScale,
  type DimensionPicker,
  type FilterMode,
  type ValueOrder,
} from "@app/ui-components";
import type { MessageKey } from "@app/i18n";
import { Icon } from "../icons/Icon";
import { Help } from "./Help";
import { EditorTextStyle, ColorPalette } from "./EditorTextStyle";
import { ReferenceLines } from "./ReferenceLines";
import { ColorRules } from "./ColorRules";
import { Section } from "./Section";
import { useTranslator } from '../Locale';

/** Personalizacion de un objeto DESDE el editor — secciones 4.2 y 4.3. */
export function Presentation({
  instance,
  admitidas,
  iconos,
  kinds,
  saving,
  onCambiar,
}: {
  instance: ObjectInstance;
  admitidas: PresentationKey[];
  /*
   * La lista de iconos viene del SERVIDOR.
   *
   * Era `OBJECT_ICONS`, leido aqui mismo, y por eso deshabilitar un icono desde el panel no lo
   * quitaba de este desplegable: una lista escrita en el cliente no sabe nada del almacen de
   * gobierno.
   */
  iconos: IconName[];
  /** Tipo de cada columna del dataset, para ofrecer los selectores que tienen sentido. */
  kinds: Record<string, string>;
  saving: boolean;
  onCambiar: (change: (i: ObjectInstance) => ObjectInstance) => void;
}) {
  const t = useTranslator();
  const p = instance.presentation ?? {};
  const admite = (clave: PresentationKey) => admitidas.includes(clave);
  const prueba = `pres-${instance.instanceId}`;

  const set = (parcial: Partial<ObjectPresentation>) =>
    onCambiar((i) => ({
      ...i,
      presentation: { ...i.presentation, ...parcial },
    }));

  /*
   * El estilo de un texto se funde con lo que ya hubiera de los OTROS textos.
   */
  const textSet = (destino: TextTarget, style: TextStyle) =>
    onCambiar((i) => ({
      ...i,
      presentation: {
        ...i.presentation,
        textos: { ...i.presentation?.textos, [destino]: style },
      },
    }));

  /*
   * Subsecciones, no una tira de veinte controles.
   */
  const measureHas = admite("formato") || admite("formatos");
  // La forma anterior era un booleano; se normaliza una vez aqui para que el panel no tenga que
  // preguntarse en cada control cual de las dos formas le ha llegado.
  const labels = normalizedLabels(p.datumLabels);
  const chartHas =
    admite("leyenda") || admite("datumLabels") || admite("orden") || admite("apilado");
  const isCard = instance.objectId === "tarjeta-kpi";
  const showTitle = p.showTitle !== false;

  return (
    <div className="editor__presentation" data-testid={prueba}>
      <Section
          keys={['titulo', 'subtitulo', 'icono', 'cabecera', 'nombre', 'texto']}
          titulo="Rotulo" nivel={2} prueba={`${prueba}-rotulo`}>
        <label className="editor__interruptor">
          <input
            type="checkbox"
            checked={showTitle}
            disabled={saving}
            data-testid={`${prueba}-mostrar-titulo`}
            onChange={(e) => set({ showTitle: e.target.checked })}
          />{" "}
          Mostrar titulo
        </label>

        {/*
          El texto del titulo, AQUI y no en la pestana Datos.
          Datos es de donde sale la cifra —dataset, campos, agregacion—; como se rotula es
          formato. Tenerlo repartido obligaba a cambiar de pestana para tocar lo mismo.
        */}
        <label className="form__field">
          <span>{t('pres.title')}</span>
          <input
            defaultValue={instance.title ?? ""}
            disabled={saving || !showTitle}
            data-testid={`${prueba}-titulo-texto`}
            // `onBlur` y no `onChange`: cada cambio guarda el modulo entero contra el servidor.
            onBlur={(e) => onCambiar((i) => ({ ...i, title: e.target.value }))}
          />
        </label>

        {admite("textos") ? (
          <EditorTextStyle
            titulo="Estilo del titulo"
            style={p.textos?.titulo ?? {}}
            prueba={`${prueba}-texto-titulo`}
            saving={saving || !showTitle}
            onCambiar={(style) => textSet("titulo", style)}
          />
        ) : null}

        {admite("subtitulo") ? (
          <label className="form__field">
            <span>{t('pres.subtitle')}</span>
            <input
              defaultValue={p.subtitulo ?? ""}
              maxLength={80}
              disabled={saving}
              data-testid={`${prueba}-subtitulo`}
              onBlur={(e) => set({ subtitulo: e.target.value || undefined })}
            />
          </label>
        ) : null}

        {admite("textos") ? (
          <EditorTextStyle
            titulo="Estilo del subtitulo"
            style={p.textos?.subtitulo ?? {}}
            prueba={`${prueba}-texto-subtitulo`}
            saving={saving}
            onCambiar={(style) => textSet("subtitulo", style)}
          />
        ) : null}

        {admite("showIcon") ? (
          <label className="editor__interruptor">
            <input
              type="checkbox"
              checked={p.showIcon !== false}
              disabled={saving}
              data-testid={`${prueba}-mostrar-icono`}
              onChange={(e) => set({ showIcon: e.target.checked })}
            />{" "}
            Mostrar icono
          </label>
        ) : null}

        {admite("icono") ? (
          <label className="form__field">
            <span>{t('pres.icon')}</span>
            <span className="editor__chosen-icon">
              {p.icono ? <Icon nombre={p.icono} tamano={18} /> : null}
              <select
                value={p.icono ?? ""}
                disabled={saving || p.showIcon === false}
                data-testid={`${prueba}-icono`}
                onChange={(e) =>
                  set({ icono: (e.target.value || undefined) as IconName | undefined })
                }
              >
                <option value="">{t('pres.icon.default')}</option>
                {iconos.map((nombre) => (
                  <option key={nombre} value={nombre}>
                    {nombre}
                  </option>
                ))}
              </select>
            </span>
          </label>
        ) : null}
      </Section>

      {admite("highlight") || admite("acento") ? (
        <Section
          keys={['resaltado', 'acento', 'color', 'linea', 'marco']}
          titulo="Borde" nivel={2} abierta={false} prueba={`${prueba}-borde`}>
          {admite("acento") ? (
            <label className="form__field">
              <span>{t('pres.accent')}</span>
              <select
                value={p.acento ?? "primario"}
                disabled={saving}
                data-testid={`${prueba}-acento`}
                onChange={(e) => set({ acento: e.target.value as ObjectAccent })}
              >
                {ACCENTS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {admite("highlight") ? (
            <>
              <label className="editor__interruptor">
                <input
                  type="checkbox"
                  checked={p.highlight === true}
                  disabled={saving}
                  data-testid={`${prueba}-resaltado`}
                  onChange={(e) => set({ highlight: e.target.checked })}
                />{" "}
                Linea de resaltado
              </label>
              {p.highlight ? (
                <div className="form__field">
                  <span>{t('pres.highlight.color')}</span>
                  {/*
                    Aparte del acento a proposito: el acento da el tono general del objeto y el
                    resaltado es una marca de estado —«esto pide atencion»— que a veces tiene que
                    decir algo distinto. «Predeterminado» es «el del acento».
                  */}
                  <ColorPalette
                    valor={p.highlightColor ?? "predeterminado"}
                    nombre="la linea de resaltado"
                    prueba={`${prueba}-color-resaltado`}
                    onCambiar={(color) =>
                      set({ highlightColor: color === "predeterminado" ? undefined : color })
                    }
                  />
                </div>
              ) : null}
            </>
          ) : null}
        </Section>
      ) : null}

      {measureHas ? (
        <Section
          keys={['formato', 'decimales', 'moneda', 'porcentaje', 'unidad', 'miles', 'cifra', 'numero', 'valor', 'etiqueta']}
          titulo="Medida" nivel={2} abierta={false} prueba={`${prueba}-medida`}>
          <MeasureFormat
            instance={instance}
            saving={saving}
            prueba={prueba}
            onCambiar={onCambiar}
          />

          <Section titulo="Valor" nivel={2} abierta={false} prueba={`${prueba}-valor`}>
            {admite("textos") ? (
              <EditorTextStyle
                titulo="Estilo del valor"
                withVertical={isCard}
                help={
                  isCard
                    ? "La cifra grande. La alineacion vertical la coloca dentro del alto de la tarjeta."
                    : undefined
                }
                style={p.textos?.valor ?? {}}
                prueba={`${prueba}-texto-valor`}
                saving={saving}
                onCambiar={(style) => textSet("valor", style)}
              />
            ) : null}
          </Section>

          {isCard ? (
            <Section titulo="Etiqueta" nivel={2} abierta={false} prueba={`${prueba}-etiqueta`}>
              <label className="form__field">
                <span>{t('pres.text')}</span>
                <input
                  defaultValue={p.etiqueta?.content ?? ""}
                  maxLength={40}
                  disabled={saving}
                  data-testid={`${prueba}-etiqueta-texto`}
                  onBlur={(e) =>
                    set({ etiqueta: { ...p.etiqueta, content: e.target.value || undefined } })
                  }
                />
              </label>
              <label className="form__field">
                <span>{t('pres.position')}</span>
                <select
                  value={p.etiqueta?.cellPosition ?? "debajo"}
                  disabled={saving}
                  data-testid={`${prueba}-etiqueta-posicion`}
                  onChange={(e) =>
                    set({
                      etiqueta: {
                        ...p.etiqueta,
                        cellPosition: e.target.value as LabelPosition,
                      },
                    })
                  }
                >
                  {LABEL_POSITIONS.map((pos) => (
                    <option key={pos} value={pos}>
                      {pos === "encima" ? "Encima del valor" : "Debajo del valor"}
                    </option>
                  ))}
                </select>
              </label>
              {admite("textos") ? (
                <EditorTextStyle
                  titulo="Estilo de la etiqueta"
                  style={p.textos?.etiqueta ?? {}}
                  prueba={`${prueba}-texto-etiqueta`}
                  saving={saving}
                  onCambiar={(style) => textSet("etiqueta", style)}
                />
              ) : null}
            </Section>
          ) : null}
        </Section>
      ) : null}

      {chartHas ? (
        <Section
          keys={['leyenda', 'etiquetas de dato', 'apilado', '100 %', 'orden', 'ordenar', 'cifra sobre la barra']}
          titulo="Grafico" nivel={2} abierta={false} prueba={`${prueba}-grafico`}>
          {admite("leyenda") ? (
            <label className="form__field">
              <span>{t('pres.legend')}</span>
              <select
                value={p.leyenda ?? "auto"}
                disabled={saving}
                data-testid={`${prueba}-leyenda`}
                onChange={(e) => set({ leyenda: e.target.value as LegendMode })}
              >
                {LEGEND_MODES.map((m) => (
                  <option key={m} value={m}>
                    {LEGEND_LABEL[m]}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {admite("datumLabels") ? (
            <>
              <label className="editor__interruptor">
                <input
                  type="checkbox"
                  checked={labels.mostrar === true}
                  disabled={saving}
                  data-testid={`${prueba}-etiquetas`}
                  // Se guarda como objeto en cuanto se toca, aunque venga de la forma antigua:
                  // asi la posicion y «solo los extremos» tienen donde vivir desde el primer clic.
                  onChange={(e) => set({ datumLabels: { mostrar: e.target.checked } })}
                />{" "}
                Cifra sobre cada barra o punto
              </label>

              {labels.mostrar ? (
                <>
                  <label className="form__field">
                    <span>{t('pres.legend.where')}</span>
                    <select
                      value={labels.cellPosition ?? "auto"}
                      disabled={saving}
                      data-testid={`${prueba}-posicion-dato`}
                      onChange={(e) =>
                        set({
                          datumLabels: {
                            ...labels,
                            cellPosition: e.target.value as DatumPosition,
                          },
                        })
                      }
                    >
                      {DATUM_POSITIONS.map((pos) => (
                        <option key={pos} value={pos}>
                          {POSITION_LABEL[pos]}
                        </option>
                      ))}
                    </select>
                  </label>

                  {/*
                    Con veinte categorias, «todas» es una maranha y «ninguna» obliga a leer el eje
                    punto por punto. El maximo y el minimo son los dos por los que se mira un
                    grafico, y rotular solo esos dos es la tercera opcion que faltaba.
                  */}
                  <label className="editor__interruptor">
                    <input
                      type="checkbox"
                      checked={labels.onlyEnds === true}
                      disabled={saving}
                      data-testid={`${prueba}-solo-extremos`}
                      onChange={(e) =>
                        set({
                          datumLabels: { ...labels, onlyEnds: e.target.checked },
                        })
                      }
                    />{" "}
                    Solo el maximo y el minimo de cada serie
                  </label>
                </>
              ) : null}
            </>
          ) : null}

          {admite("apilado") ? (
            <label className="form__field">
              <span>{t('pres.stacked')}</span>
              <select
                value={p.apilado ?? "ninguno"}
                disabled={saving}
                data-testid={`${prueba}-apilado`}
                onChange={(e) => set({ apilado: e.target.value as StackingMode })}
              >
                {STACKING_MODES.map((m) => (
                  <option key={m} value={m}>
                    {STACKING_LABEL[m]}
                  </option>
                ))}
              </select>
              <span className="field__pista">
                {t('pres.stacked.help')}
              </span>
            </label>
          ) : null}

          {admite("orden") ? (
            <>
              <label className="form__field">
                <span>{t('pres.sort.by')}</span>
                <select
                  value={p.orden?.por ?? "ninguno"}
                  disabled={saving}
                  data-testid={`${prueba}-orden-por`}
                  onChange={(e) =>
                    set({
                      orden:
                        e.target.value === "ninguno"
                          ? undefined
                          : { ...p.orden, por: e.target.value as SortCriterion },
                    })
                  }
                >
                  <option value="ninguno">{t('pres.sort.dataset')}</option>
                  <option value="categoria">{t('pres.sort.category')}</option>
                  <option value="valor">{t('pres.sort.measure')}</option>
                </select>
              </label>

              {p.orden?.por ? (
                <label className="form__field">
                  <span>{t('pres.sort.direction')}</span>
                  <select
                    value={p.orden.direction ?? "asc"}
                    disabled={saving}
                    data-testid={`${prueba}-orden-direccion`}
                    onChange={(e) =>
                      set({
                        orden: { ...p.orden, direction: e.target.value as "asc" | "desc" },
                      })
                    }
                  >
                    <option value="asc">{t('pres.sort.ascending')}</option>
                    <option value="desc">{t('pres.sort.descending')}</option>
                  </select>
                </label>
              ) : null}
            </>
          ) : null}
        </Section>
      ) : null}

      {admite("multiplos") ? (
        <Section
          keys={['paneles', 'repetir', 'por cada', 'escala comun', 'columnas']}
          titulo="Multiplos" nivel={2} abierta={false} prueba={`${prueba}-multiplos`}>
          <p className="field__pista">
            Ponga una dimension en el pozo «Multiplos», en la pestana Datos, y el objeto se repite
            una vez por cada valor.
          </p>

          <label className="form__field">
            <span>{t('pres.columns')}</span>
            <select
              value={String(p.multiplos?.gridColumns ?? 0)}
              disabled={saving}
              data-testid={`${prueba}-multiplos-columnas`}
              onChange={(e) =>
                set({
                  multiplos: {
                    ...p.multiplos,
                    gridColumns: e.target.value === "0" ? undefined : Number(e.target.value),
                  },
                })
              }
            >
              <option value="0">{t('pres.columns.automatic')}</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
            </select>
          </label>

          {/*
            La escala comun viene encendida, y esa es la decision que importa. Con escalas
            independientes, seis paneles de alturas parecidas pueden estar diciendo 20 y 2.000: la
            comparacion, que es la unica razon de ponerlos juntos, sale al reves.
          */}
          <label className="editor__interruptor">
            <input
              type="checkbox"
              checked={p.multiplos?.sameScale !== false}
              disabled={saving}
              data-testid={`${prueba}-misma-escala`}
              onChange={(e) =>
                set({ multiplos: { ...p.multiplos, sameScale: e.target.checked } })
              }
            />{" "}
            Misma escala en todos los paneles
          </label>
          <span className="field__pista">
            Apagarla solo tiene sentido cuando lo que se compara es la FORMA de cada serie y no su
            magnitud.
          </span>
        </Section>
      ) : null}

      {admite("tooltip") ? (
        <Section
          keys={['total', 'al senalar', 'globo', 'emergente']}
          titulo="Tooltip" nivel={2} abierta={false} prueba={`${prueba}-tooltip`}>
          <label className="editor__interruptor">
            <input
              type="checkbox"
              checked={p.tooltip?.total === true}
              disabled={saving}
              data-testid={`${prueba}-tooltip-total`}
              onChange={(e) => set({ tooltip: { ...p.tooltip, total: e.target.checked } })}
            />{" "}
            Anadir el total de la categoria
          </label>
          {/*
            En un apilado es el dato que casi siempre falta: el grafico ensena los trozos y la
            suma hay que hacerla de cabeza, justo cuando se esta comparando una categoria con otra.
          */}
          <label className="editor__interruptor">
            <input
              type="checkbox"
              checked={p.tooltip?.sortValue === true}
              disabled={saving}
              data-testid={`${prueba}-tooltip-orden`}
              onChange={(e) =>
                set({ tooltip: { ...p.tooltip, sortValue: e.target.checked } })
              }
            />{" "}
            Ordenar las dataRows de mayor a menor
          </label>
        </Section>
      ) : null}

      {admite("condicional") ? (
        <Section
          keys={['condicional', 'regla', 'umbral', 'semaforo', 'alerta', 'rojo']}
          titulo="Color por valor" nivel={2} abierta={false} prueba={`${prueba}-condicional`}>
          <ColorRules
            rules={p.condicional?.rules ?? []}
            medidas={instance.binding.measures}
            saving={saving}
            prueba={`${prueba}-cond`}
            onCambiar={(rules) => set({ condicional: rules ? { rules } : undefined })}
          />
        </Section>
      ) : null}

      {admite("referencias") ? (
        <Section
          keys={['meta', 'umbral', 'objetivo', 'promedio', 'raya', 'constante']}
          titulo="Lineas de referencia" nivel={2} abierta={false} prueba={`${prueba}-referencias`}>
          <ReferenceLines
            lineas={p.referencias ?? []}
            saving={saving}
            prueba={`${prueba}-ref`}
            onCambiar={(referencias) => set({ referencias })}
          />
        </Section>
      ) : null}

      {admite("seriesColors") ? (
        <Section
          keys={['paleta', 'color de serie', 'tema']}
          titulo="Colores de las series" nivel={2} abierta={false} prueba={`${prueba}-colores`}>
          {/*
            Se elige CUAL de los ocho colores del tema le toca a cada serie, no un color libre.
            Un color suelto no tiene par de contraste comprobado ni sigue al tema oscuro; esto
            resuelve el caso real —«resueltos en verde, como en el resto del informe»— sin salirse
            del sistema.
          */}
          {instance.binding.measures.length === 0 ? (
            <p className="field__pista">{t('pres.color.noMeasure')}</p>
          ) : (
            instance.binding.measures.map((medida, s) => (
              <label key={medida} className="form__field">
                <span>{medida}</span>
                <select
                  value={p.seriesColors?.[s] ?? s}
                  disabled={saving}
                  data-testid={`${prueba}-color-serie-${s}`}
                  onChange={(e) => {
                    const siguiente = [...(p.seriesColors ?? [])];
                    while (siguiente.length < instance.binding.measures.length) {
                      siguiente.push(siguiente.length);
                    }
                    siguiente[s] = Number(e.target.value);
                    set({ seriesColors: siguiente });
                  }}
                >
                  {PALETTE_COLORS.map((n) => (
                    <option key={n} value={n}>
                      Color {n + 1}
                    </option>
                  ))}
                </select>
              </label>
            ))
          )}
        </Section>
      ) : null}

      {admite("circular") ? (
        <Section
          keys={['pastel', 'dona', 'hueco', 'anillo', 'circular', 'porcentaje', 'total en el centro']}
          titulo="Porciones" nivel={2} prueba={`${prueba}-circular`}>
          {/*
            El hueco es un DESLIZADOR y no una casilla «dona si/no».
            Entre un pastel y una dona no hay dos estados sino un canje continuo: cuanto mas
            hueco, menos area para comparar porciones y mas sitio para la cifra del centro.
            Con dos posiciones, ese canje se toma sin verlo.
          */}
          <label className="form__field">
            <span>Hueco del centro: {p.circular?.radioInterior ?? 0} %</span>
            <input
              type="range"
              min={0}
              max={MAX_RADIO_INTERIOR}
              step={5}
              value={p.circular?.radioInterior ?? 0}
              disabled={saving}
              data-testid={`${prueba}-hueco`}
              onChange={(e) =>
                set({ circular: { ...p.circular, radioInterior: Number(e.target.value) } })
              }
            />
            <span className="field__pista">{t('pres.hole.help')}</span>
          </label>

          <label className="form__field">
            <span>{t('pres.slices.labels')}</span>
            <select
              value={p.circular?.labels ?? "porcentaje"}
              disabled={saving}
              data-testid={`${prueba}-etiquetas-circular`}
              onChange={(e) =>
                set({
                  circular: { ...p.circular, labels: e.target.value as PieLabel },
                })
              }
            >
              {CIRCULAR_LABELS.map((m) => (
                <option key={m} value={m}>
                  {PIE_LABEL[m]}
                </option>
              ))}
            </select>
          </label>

          <label className="editor__interruptor">
            <input
              type="checkbox"
              checked={p.circular?.ordenar !== false}
              disabled={saving}
              data-testid={`${prueba}-ordenar-porciones`}
              onChange={(e) => set({ circular: { ...p.circular, ordenar: e.target.checked } })}
            />{" "}
            Ordenar de mayor a menor
          </label>

          <label className="editor__interruptor">
            <input
              type="checkbox"
              checked={p.circular?.totalEnElCentro === true}
              disabled={saving || (p.circular?.radioInterior ?? 0) === 0}
              data-testid={`${prueba}-total-centro`}
              onChange={(e) =>
                set({ circular: { ...p.circular, totalEnElCentro: e.target.checked } })
              }
            />{" "}
            Total en el centro
          </label>
          {(p.circular?.radioInterior ?? 0) === 0 ? (
            <p className="field__pista">{t('pres.hole.noHole')}</p>
          ) : null}
        </Section>
      ) : null}

      {admite("medidor") ? (
        <Section
          keys={['medidor', 'tacometro', 'aguja', 'minimo', 'maximo', 'objetivo']}
          titulo="Escala" nivel={2} prueba={`${prueba}-medidor`}>
          {/*
            Vacio NO es cero: vacio es «dedúcela».
            Un `Number("")` da 0 y dejaria el maximo en cero, o sea la aguja siempre al tope. Se
            distingue la cadena vacia antes de convertir, y por eso el estado es `undefined`.
          */}
          <div className="form__pair">
            <label className="form__field">
              <span>{t('pres.min')}</span>
              <input
                type="number"
                defaultValue={p.medidor?.minimo ?? ""}
                disabled={saving}
                data-testid={`${prueba}-minimo`}
                onBlur={(e) =>
                  set({
                    medidor: {
                      ...p.medidor,
                      minimo: e.target.value === "" ? undefined : Number(e.target.value),
                    },
                  })
                }
              />
            </label>
            <label className="form__field">
              <span>{t('pres.max')}</span>
              <input
                type="number"
                defaultValue={p.medidor?.maximo ?? ""}
                disabled={saving}
                data-testid={`${prueba}-maximo`}
                onBlur={(e) =>
                  set({
                    medidor: {
                      ...p.medidor,
                      maximo: e.target.value === "" ? undefined : Number(e.target.value),
                    },
                  })
                }
              />
            </label>
          </div>
          <span className="field__pista">
            Vacio = se deduce de los datos, redondeando a una scale estable. Fijarla es lo que
            permite compare dos capturas del mismo medidor.
          </span>

          <label className="form__field">
            <span>{t('pres.target')}</span>
            <input
              type="number"
              defaultValue={p.medidor?.objetivo ?? ""}
              disabled={saving}
              data-testid={`${prueba}-objetivo`}
              onBlur={(e) =>
                set({
                  medidor: {
                    ...p.medidor,
                    objetivo: e.target.value === "" ? undefined : Number(e.target.value),
                  },
                })
              }
            />
            <span className="field__pista">
              Solo se usa si el mapeo no trae una medida de objetivo: un dato se actualiza y un
              numero escrito aqui no.
            </span>
          </label>

          <label className="editor__interruptor">
            <input
              type="checkbox"
              checked={p.medidor?.showValue !== false}
              disabled={saving}
              data-testid={`${prueba}-mostrar-valor`}
              onChange={(e) => set({ medidor: { ...p.medidor, showValue: e.target.checked } })}
            />{" "}
            Mostrar la cifra bajo la aguja
          </label>
        </Section>
      ) : null}

      {admite("embudo") ? (
        <Section
          keys={['embudo', 'etapa', 'conversion', 'proceso']}
          titulo="Caida" nivel={2} prueba={`${prueba}-embudo`}>
          <label className="form__field">
            <span>{t('pres.label.comparedTo')}</span>
            <select
              value={p.embudo?.compare ?? "primero"}
              disabled={saving}
              data-testid={`${prueba}-comparar`}
              onChange={(e) => set({ embudo: { compare: e.target.value as FunnelComparison } })}
            >
              {FUNNEL_COMPARISONS.map((c) => (
                <option key={c} value={c}>
                  {COMPARISON_LABEL[c]}
                </option>
              ))}
            </select>
            {/*
              Son dos preguntas distintas, no dos formas de decir lo mismo: «cuanto queda de lo
              que entro» y «cuanto se pierde en ESTE paso». Con una sola, la otra hay que
              calcularla de cabeza, que es lo que el objeto viene a evitar.
            */}
            <span className="field__pista">
              {t('pres.stages.sort')}
            </span>
          </label>
        </Section>
      ) : null}

      {admite("cascada") ? (
        <Section
          keys={['contribucion', 'total', 'waterfall', 'signo']}
          titulo="Cascada" nivel={2} prueba={`${prueba}-cascada`}>
          <label className="editor__interruptor">
            <input
              type="checkbox"
              checked={p.cascada?.showTotal !== false}
              disabled={saving}
              data-testid={`${prueba}-mostrar-total`}
              onChange={(e) => set({ cascada: { showTotal: e.target.checked } })}
            />{" "}
            Barra final con el total
          </label>
          <span className="field__pista">
            El signo va SIEMPRE en la etiqueta: el color distingue subida de bajada, pero no puede
            ser el unico medio de decirlo.
          </span>
        </Section>
      ) : null}

      {admite("combinado") ? (
        <Section
          keys={['eje secundario', 'combinado', 'derecha', 'dos escalas']}
          titulo="Eje secundario" nivel={2} prueba={`${prueba}-combinado`}>
          <label className="editor__interruptor">
            <input
              type="checkbox"
              checked={p.combinado?.axisSecondary === true}
              disabled={saving}
              data-testid={`${prueba}-eje-secundario`}
              onChange={(e) => set({ combinado: { axisSecondary: e.target.checked } })}
            />{" "}
            Medir las lineas en un eje aparte, a la derecha
          </label>
          {/*
            La advertencia va aqui y no en la ayuda del campo, a proposito.
            Dos escalas se pueden elegir para que dos series se crucen donde a uno le convenga, y
            eso es un grafico enganoso. No se impide —hay casos legitimos, y son la razon de ser
            del objeto— pero quien lo enciende tiene que leer que lo esta haciendo.
          */}
          <span className="field__pista">
            Con dos escalas, una linea por encima de las gridColumns puede valer la mitad. Rotule los
            dos ejes en la seccion «Ejes» para que se pueda leer sin adivinar.
          </span>
        </Section>
      ) : null}

      {admite("axes") ? (
        <Section
          keys={['eje', 'cuadricula', 'titulo del eje', 'empezar en cero', 'minimo', 'maximo', 'girar', 'rotar']}
          titulo="Ejes" nivel={2} abierta={false} prueba={`${prueba}-ejes`}>
          <label className="editor__interruptor">
            <input
              type="checkbox"
              checked={p.axes?.showX !== false}
              disabled={saving}
              data-testid={`${prueba}-eje-x`}
              onChange={(e) => set({ axes: { ...p.axes, showX: e.target.checked } })}
            />{" "}
            Mostrar el eje de categorias
          </label>

          <label className="form__field">
            <span>{t('pres.axis.categories.title')}</span>
            <input
              defaultValue={p.axes?.xTitle ?? ""}
              disabled={saving}
              data-testid={`${prueba}-titulo-x`}
              onBlur={(e) => set({ axes: { ...p.axes, xTitle: e.target.value || undefined } })}
            />
            {/*
              Se escribe a mano y no sale del nombre del campo: `DimTribunal.Distrito` en un
              objeto de 400 px se recortaba a una letra suelta al borde del grafico.
            */}
            <span className="field__pista">{t('pres.axis.noTitle')}</span>
          </label>

          {p.combinado?.axisSecondary ? (
            <label className="form__field">
              <span>{t('pres.axis.right.title')}</span>
              <input
                defaultValue={p.axes?.y2Title ?? ""}
                disabled={saving}
                data-testid={`${prueba}-titulo-y2`}
                onBlur={(e) => set({ axes: { ...p.axes, y2Title: e.target.value || undefined } })}
              />
              <span className="field__pista">{t('pres.axis.right.help')}</span>
            </label>
          ) : null}

          <label className="editor__interruptor">
            <input
              type="checkbox"
              checked={p.axes?.showY !== false}
              disabled={saving}
              data-testid={`${prueba}-eje-y`}
              onChange={(e) => set({ axes: { ...p.axes, showY: e.target.checked } })}
            />{" "}
            Mostrar el eje de valores
          </label>

          <label className="form__field">
            <span>{t('pres.axis.values.title')}</span>
            <input
              defaultValue={p.axes?.yTitle ?? ""}
              disabled={saving}
              data-testid={`${prueba}-titulo-y`}
              onBlur={(e) => set({ axes: { ...p.axes, yTitle: e.target.value || undefined } })}
            />
          </label>

          <label className="editor__interruptor">
            <input
              type="checkbox"
              checked={p.axes?.gridlines !== false}
              disabled={saving}
              data-testid={`${prueba}-cuadricula`}
              onChange={(e) => set({ axes: { ...p.axes, gridlines: e.target.checked } })}
            />{" "}
            Lineas de cuadricula
          </label>

          <label className="editor__interruptor">
            <input
              type="checkbox"
              checked={p.axes?.fromZero !== false}
              disabled={saving}
              data-testid={`${prueba}-desde-cero`}
              onChange={(e) => set({ axes: { ...p.axes, fromZero: e.target.checked } })}
            />{" "}
            Empezar en cero
          </label>

          <label className="form__field">
            <span>{t('pres.axis.scale')}</span>
            <select
              value={p.axes?.scale ?? 'lineal'}
              disabled={saving}
              data-testid={`${prueba}-escala`}
              onChange={(e) =>
                set({
                  axes: {
                    ...p.axes,
                    scale: e.target.value === 'lineal' ? undefined : (e.target.value as AxisScale),
                    // Volver a lineal no puede dejar puesto lo que la logaritmica prohibia, ni al
                    // reves: elegir logaritmica con «empezar en cero» encendido guardaria algo que
                    // la validacion rechaza y que quien lo eligio no escribio.
                    ...(e.target.value === 'logaritmica' ? { fromZero: false } : {}),
                  },
                })
              }
            >
              {AXIS_SCALES.map((escala) => (
                <option key={escala} value={escala}>
                  {t(ESCALA[escala])}
                </option>
              ))}
            </select>
          </label>
          {p.axes?.scale === 'logaritmica' ? (
            <p className="field__pista">{t('pres.axis.scale.logHelp')}</p>
          ) : null}

          <label className="editor__interruptor">
            <input
              type="checkbox"
              checked={p.axes?.zoom === true}
              disabled={saving}
              data-testid={`${prueba}-zoom`}
              onChange={(e) => set({ axes: { ...p.axes, zoom: e.target.checked || undefined } })}
            />{" "}
            {t('pres.axis.zoom')}
          </label>
          <p className="field__pista">{t('pres.axis.zoom.help')}</p>
          <p className="field__pista">
            Un eje que no empieza en cero hace que una diferencia del 2 % parezca el triple.
            Apagarlo deberia ser una decision, no el comportamiento por omision.
          </p>

          {/*
            Vacio NO es cero: vacio es «que lo decida la escala».
            `Number("")` da 0, asi que sin distinguir la cadena vacia, borrar el campo dejaria el
            eje clavado en cero en vez de devolverlo a automatico.
          */}
          <div className="form__pair">
            <label className="form__field">
              <span>{t('pres.axis.min')}</span>
              <input
                type="number"
                defaultValue={p.axes?.yMin ?? ""}
                disabled={saving}
                data-testid={`${prueba}-minimo-y`}
                onBlur={(e) =>
                  set({
                    axes: {
                      ...p.axes,
                      yMin: e.target.value === "" ? undefined : Number(e.target.value),
                    },
                  })
                }
              />
            </label>
            <label className="form__field">
              <span>{t('pres.axis.max')}</span>
              <input
                type="number"
                defaultValue={p.axes?.yMax ?? ""}
                disabled={saving}
                data-testid={`${prueba}-maximo-y`}
                onBlur={(e) =>
                  set({
                    axes: {
                      ...p.axes,
                      yMax: e.target.value === "" ? undefined : Number(e.target.value),
                    },
                  })
                }
              />
            </label>
          </div>
          <span className="field__pista">
            Vacio = automatico. Fijarlos es lo que hace comparables dos objetos de la misma medida,
            y tambien la forma mas facil de exagerar una diferencia.
          </span>

          <label className="form__field">
            <span>{t('pres.tickLabels.rotate')}</span>
            <select
              value={String(p.axes?.rotateX ?? 0)}
              disabled={saving}
              data-testid={`${prueba}-rotar-x`}
              onChange={(e) =>
                set({
                  axes: {
                    ...p.axes,
                    rotateX: e.target.value === "0" ? undefined : Number(e.target.value),
                  },
                })
              }
            >
              <option value="0">{t('pres.tickLabels.horizontal')}</option>
              <option value="30">{t('pres.tickLabels.30')}</option>
              <option value="45">{t('pres.tickLabels.45')}</option>
              <option value="90">{t('pres.tickLabels.vertical')}</option>
            </select>
            {/*
              Sin girar, ECharts esconde los rotulos que no caben y el grafico acaba ensenando una
              de cada tres categorias sin decir que las demas siguen ahi. Girados se ven todas.
            */}
            <span className="field__pista">
              {t('pres.tickLabels.help')}
            </span>
          </label>
        </Section>
      ) : null}

      {instance.objectId === "panel-de-filtros" ? (
        <Section
          keys={['filtro', 'panel de filtros', 'desplegable', 'fecha']}
          titulo="Selectores" nivel={2} prueba={`${prueba}-selectores`}>
          <PanelPickers
            instance={instance}
            kinds={kinds}
            saving={saving}
            onCambiar={onCambiar}
          />
        </Section>
      ) : null}

    </div>
  );
}

/** El tipo de selector de cada dimension del panel. */
function PanelPickers({
  instance,
  kinds,
  saving,
  onCambiar,
}: {
  instance: ObjectInstance;
  kinds: Record<string, string>;
  saving: boolean;
  onCambiar: (change: (i: ObjectInstance) => ObjectInstance) => void;
}) {
  const t = useTranslator();
  const settings =
    instance.settings?.objectId === "panel-de-filtros"
      ? instance.settings
      : undefined;
  const effective = effectivePickers(instance, settings, kinds);
  const prueba = `selectores-${instance.instanceId}`;

  /*
   * Se MEZCLA con lo que el campo ya tenia, no se reconstruye.
   *
   * Antes esto reescribia el selector entero y solo conservaba la etiqueta: cambiar el tipo de
   * control borraba el orden de los valores, el recuento y los botones de «Todos» — ajustes que
   * nadie habia tocado y que desaparecian por cambiar otra cosa.
   */
  const pickerSet = (fieldName: string, cambio: Partial<DimensionPicker>) =>
    onCambiar((i) => {
      const previos =
        i.settings?.objectId === "panel-de-filtros" ? i.settings.pickers : [];
      const anterior =
        previos.find((s) => s.fieldName === fieldName) ??
        effective.find((s) => s.fieldName === fieldName);
      const base: DimensionPicker = {
        fieldName,
        tipo: anterior?.tipo ?? defaultPicker(kinds[fieldName] ?? ""),
        ...(anterior && "etiqueta" in anterior && anterior.etiqueta
          ? { etiqueta: anterior.etiqueta }
          : {}),
        ...(anterior && "orden" in anterior && anterior.orden
          ? { orden: anterior.orden }
          : {}),
        ...(anterior && "nivel" in anterior && anterior.nivel
          ? { nivel: anterior.nivel }
          : {}),
        ...(anterior && "modos" in anterior && anterior.modos
          ? { modos: anterior.modos }
          : {}),
        ...(anterior && "recuento" in anterior ? { recuento: anterior.recuento } : {}),
        ...(anterior && "todos" in anterior ? { todos: anterior.todos } : {}),
        ...(anterior && "plegado" in anterior ? { plegado: anterior.plegado } : {}),
      };
      return {
        ...i,
        settings: {
          objectId: "panel-de-filtros",
          pickers: [
            ...previos.filter((s) => s.fieldName !== fieldName),
            { ...base, ...cambio },
          ],
        },
      };
    });

  if (effective.length === 0) {
    return (
      <p className="muted-text" data-testid={`${prueba}-vacio`}>
        {t('pres.pickers.noDimension')}
      </p>
    );
  }

  return (
    <div className="editor__pickers" data-testid={prueba}>
      <p className="muted-text">{t('pres.pickers.title')}</p>
      {effective.map((s) => {
        const columnKind = kinds[s.fieldName] ?? "";
        const posibles = modesByDefault(columnKind);
        return (
          <fieldset key={s.fieldName}>
            <legend>{s.fieldName}</legend>

            <label className="form__field">
              <span>{t('pres.pickers.kind')}</span>
              <select
                value={s.tipo}
                disabled={saving}
                data-testid={`${prueba}-${s.fieldName}`}
                onChange={(e) =>
                  pickerSet(s.fieldName, { tipo: e.target.value as PickerKind })
                }
              >
                {PICKER_KINDS.map((tipo) => (
                  <option key={tipo} value={tipo} disabled={!aplicaA(tipo, columnKind)}>
                    {tipo}
                    {aplicaA(tipo, columnKind) ? "" : ` — ${t('pres.pickers.needsDate')}`}
                  </option>
                ))}
              </select>
            </label>

            <label className="form__field">
              <span>{t('pres.pickers.order')}</span>
              <select
                value={s.orden}
                disabled={saving}
                data-testid={`${prueba}-${s.fieldName}-orden`}
                onChange={(e) =>
                  pickerSet(s.fieldName, { orden: e.target.value as ValueOrder })
                }
              >
                {VALUE_ORDERS.map((orden) => (
                  <option key={orden} value={orden}>
                    {t(ORDEN[orden])}
                  </option>
                ))}
              </select>
            </label>

            {/*
              Basico o avanzado. Lo decide AQUI quien configura el objeto.
              Era un interruptor dentro del propio panel, y eso lo convertia en una preferencia de
              quien miraba: un campo que se configuro para dar solo una lista de valores se podia
              pasar a avanzado desde la pantalla.
            */}
            <label className="form__field">
              <span>{t('pres.pickers.level')}</span>
              <select
                value={s.nivel}
                disabled={saving}
                data-testid={`${prueba}-${s.fieldName}-nivel`}
                onChange={(e) =>
                  pickerSet(s.fieldName, { nivel: e.target.value as PickerLevel })
                }
              >
                {PICKER_LEVELS.map((nivel) => (
                  <option key={nivel} value={nivel}>
                    {t(NIVEL[nivel])}
                  </option>
                ))}
              </select>
            </label>

            {/*
              Las formas de acotar que ofrece ESTE campo.
              Se ofrecen solo las que tienen sentido por el tipo de la columna —un «entre» sobre
              una materia no significa nada— y la validacion rechaza las demas: aqui ni siquiera
              se ensenan, para no proponer algo que despues bloquea la publicacion.
            */}
            {/* En basico no se ofrece ninguna forma de acotar: solo hay una, la lista. */}
            <div hidden={s.nivel === 'basico'}>
              <span className="filters-panel__label">{t('pres.pickers.modes')}</span>
              {posibles.map((modo) => {
                const puestos = s.modos;
                const marcado = puestos.includes(modo);
                return (
                  <label key={modo} className="form__check">
                    <input
                      type="checkbox"
                      checked={marcado}
                      // El ultimo no se puede quitar: un campo sin ninguna forma de acotar es un
                      // filtro que no filtra, y la validacion lo trata como «no se dijo».
                      disabled={saving || (marcado && puestos.length === 1)}
                      data-testid={`${prueba}-${s.fieldName}-modo-${modo}`}
                      onChange={() =>
                        pickerSet(s.fieldName, {
                          modos: marcado
                            ? puestos.filter((m) => m !== modo)
                            : posibles.filter((m) => puestos.includes(m) || m === modo),
                        })
                      }
                    />
                    <span>{t(MODO_ROTULO[modo])}</span>
                  </label>
                );
              })}
            </div>

            <label className="form__check">
              <input
                type="checkbox"
                checked={s.recuento}
                disabled={saving}
                data-testid={`${prueba}-${s.fieldName}-recuento`}
                onChange={(e) => pickerSet(s.fieldName, { recuento: e.target.checked })}
              />
              <span>{t('pres.pickers.count')}</span>
            </label>

            <label className="form__check">
              <input
                type="checkbox"
                checked={s.todos}
                disabled={saving}
                data-testid={`${prueba}-${s.fieldName}-todos`}
                onChange={(e) => pickerSet(s.fieldName, { todos: e.target.checked })}
              />
              <span>{t('pres.pickers.selectAll')}</span>
            </label>

            <label className="form__check">
              <input
                type="checkbox"
                checked={s.plegado}
                disabled={saving}
                data-testid={`${prueba}-${s.fieldName}-plegado`}
                onChange={(e) => pickerSet(s.fieldName, { plegado: e.target.checked })}
              />
              <span>{t('pres.pickers.collapsed')}</span>
            </label>
          </fieldset>
        );
      })}
    </div>
  );
}

/** Como se rotula cada orden de valores, y cada forma de acotar. */
/** Como se rotula cada escala de eje. */
const ESCALA: Record<AxisScale, MessageKey> = {
  lineal: 'pres.axis.scale.linear',
  logaritmica: 'pres.axis.scale.log',
};

const ORDEN: Record<ValueOrder, MessageKey> = {
  origen: 'pres.pickers.order.source',
  alfabetico: 'pres.pickers.order.alphabetical',
  frecuencia: 'pres.pickers.order.frequency',
};

/** Basico o avanzado, en la lengua de quien configura. */
const NIVEL: Record<PickerLevel, MessageKey> = {
  basico: 'filters.basic',
  avanzado: 'filters.advanced',
};

const MODO_ROTULO: Record<FilterMode, MessageKey> = {
  valores: 'filters.mode.valores',
  excluir: 'filters.mode.excluir',
  texto: 'filters.mode.texto',
  rango: 'filters.mode.rango',
  vacios: 'filters.mode.vacios',
};

/** Un selector de fecha sobre una columna que no lo es se ofrece DESHABILITADO, no se esconde. */
function aplicaA(tipo: PickerKind, columnKind: string): boolean {
  if (tipo !== "calendario" && tipo !== "rango-de-fechas") return true;
  return ["date", "datetime", "timestamp", "fecha"].includes(
    columnKind.toLowerCase(),
  );
}

/** El formato de numero, renglon a renglon. */
function MeasureFormat({
  instance,
  saving,
  prueba,
  onCambiar,
}: {
  instance: ObjectInstance;
  saving: boolean;
  prueba: string;
  onCambiar: (change: (i: ObjectInstance) => ObjectInstance) => void;
}) {
  const formatos = instance.presentation?.formatos;
  const medidas = instance.binding.measures;

  const formatSet = (siguiente: ObjectFormats) =>
    onCambiar((i) => ({ ...i, presentation: { ...i.presentation, formatos: siguiente } }));

  const generalSet = (formato: NumberFormat) =>
    formatSet({ ...formatos, general: formato });

  const measureSet = (medida: string, formato: NumberFormat | undefined) => {
    const porMedida = { ...(formatos?.porMedida ?? {}) };
    // Quitar la excepcion se guarda BORRANDO la clave, no copiando el general: si se copiara, la
    // medida dejaria de seguir al general sin que nadie lo hubiera pedido.
    if (formato) porMedida[medida] = formato;
    else delete porMedida[medida];
    formatSet({ ...formatos, porMedida });
  };

  return (
    <>
      <FormatRow
        titulo="General"
        help="Se aplica a toda medida que no tenga el suyo. Cambiarlo cambia todas a la vez."
        formato={formatos?.general ?? {}}
        prueba={`${prueba}-formato-general`}
        saving={saving}
        onCambiar={generalSet}
      />

      {medidas.map((medida) => {
        const own = formatos?.porMedida?.[medida];
        return (
          <Section
            key={medida}
            titulo={medida}
            nivel={2}
            abierta={false}
            prueba={`${prueba}-formato-${medida}`}
          >
            <label className="editor__interruptor">
              <input
                type="checkbox"
                checked={own !== undefined}
                disabled={saving}
                data-testid={`${prueba}-excepcion-${medida}`}
                onChange={(e) => measureSet(medida, e.target.checked ? { tipo: "general" } : undefined)}
              />{" "}
              Formato propio
            </label>
            {own ? (
              <FormatRow
                titulo={`Formato de ${medida}`}
                formato={own}
                prueba={`${prueba}-formato-m-${medida}`}
                saving={saving}
                onCambiar={(formato) => measureSet(medida, formato)}
              />
            ) : null}
          </Section>
        );
      })}
    </>
  );
}

/** Un renglon: el tipo y lo que ese tipo necesite. */
function FormatRow({
  titulo,
  help,
  formato,
  prueba,
  saving,
  onCambiar,
}: {
  titulo: string;
  help?: string;
  formato: NumberFormat;
  prueba: string;
  saving: boolean;
  onCambiar: (formato: NumberFormat) => void;
}) {
  const t = useTranslator();
  const tipo = formato.tipo ?? "general";
  const cambiar = (parcial: Partial<NumberFormat>) => onCambiar({ ...formato, ...parcial });
  const issue = tipo === "personalizado" ? patternProblem(formato.pattern ?? "") : null;

  return (
    // El renglon entero lleva identificador, como la paleta y el estilo de texto: preguntar si un
    // objeto deja dar formato a sus cifras no deberia obligar a nombrar el campo de decimales.
    <div className="text-style" data-testid={prueba}>
      <p className="text-style__label">
        {titulo}
        {help ? <Help content={help} de={titulo} /> : null}
      </p>

      <label className="form__field">
        <span>{t('pres.format')}</span>
        <select
          value={tipo}
          disabled={saving}
          data-testid={`${prueba}-tipo`}
          onChange={(e) => cambiar({ tipo: e.target.value as FormatKind })}
        >
          {FORMAT_KINDS.map((t) => (
            <option key={t} value={t}>
              {KIND_LABEL[t]}
            </option>
          ))}
        </select>
      </label>

      {tipo === "personalizado" ? (
        <label className="form__field">
          <span>{t('pres.format.string')}</span>
          <input
            defaultValue={formato.pattern ?? ""}
            placeholder="#,##0.00"
            disabled={saving}
            data-testid={`${prueba}-patron`}
            aria-describedby={issue ? `${prueba}-patron-error` : undefined}
            aria-invalid={issue ? true : undefined}
            onBlur={(e) => cambiar({ pattern: e.target.value })}
          />
          {/*
            El error se dice AQUI y no solo en la lista de bloqueos: quien escribe la cadena esta
            mirando este campo, y mandarle a buscar el motivo arriba del todo es hacerle trabajar
            para descubrir algo que el editor ya sabe.
          */}
          {issue ? (
            <span className="field__error" id={`${prueba}-patron-error`} role="alert">
              {issue}
            </span>
          ) : (
            <span className="field__pista">
              {t('pres.numberFormat.help')}
            </span>
          )}
        </label>
      ) : (
        <>
          <label className="form__field">
            <span>{t('pres.format.decimals')}</span>
            <select
              value={String(formato.decimales ?? DEFAULT_DECIMALS[tipo])}
              disabled={saving || tipo === "entero"}
              data-testid={`${prueba}-decimales`}
              onChange={(e) => cambiar({ decimales: Number(e.target.value) })}
            >
              {[0, 1, 2, 3, 4].map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>

          {tipo === "moneda" ? (
            <label className="form__field">
              <span>{t('pres.format.symbol')}</span>
              <input
                defaultValue={formato.simbolo ?? "RD$"}
                maxLength={4}
                disabled={saving}
                data-testid={`${prueba}-simbolo`}
                onBlur={(e) => cambiar({ simbolo: e.target.value || undefined })}
              />
              {/*
                Se escribe y no se elige de una lista: el simbolo de una moneda es una decision de
                la institucion que publica —«RD$», «DOP», «$»— y una lista cerrada obligaria a
                tocar codigo cada vez que alguien reporte en otra divisa.
              */}
              <span className="field__pista">{t('pres.format.symbol.help')}</span>
            </label>
          ) : null}

          <label className="editor__interruptor">
            <input
              type="checkbox"
              checked={formato.millares !== false}
              disabled={saving}
              data-testid={`${prueba}-millares`}
              onChange={(e) => cambiar({ millares: e.target.checked })}
            />{" "}
            Separador de miles
          </label>

          <label className="form__field">
            <span>{t('pres.format.unit')}</span>
            <input
              defaultValue={formato.unit ?? ""}
              maxLength={8}
              disabled={saving}
              data-testid={`${prueba}-unidad`}
              onBlur={(e) => cambiar({ unit: e.target.value || undefined })}
            />
          </label>

          <label className="editor__interruptor">
            <input
              type="checkbox"
              checked={formato.compacto === true}
              disabled={saving}
              data-testid={`${prueba}-compacto`}
              onChange={(e) => cambiar({ compacto: e.target.checked })}
            />{" "}
            Compacto (12,5 k)
          </label>
        </>
      )}
    </div>
  );
}

/*
 * Los decimales que aplica el motor cuando nadie los ha tocado. Se repiten aqui porque el
 * desplegable tiene que ENSENAR el valor vigente: si dijera «0» mientras la moneda sale con dos,
 * el panel estaria mintiendo sobre lo que se ve en la tarjeta.
 */
const DEFAULT_DECIMALS: Record<FormatKind, number> = {
  general: 0,
  entero: 0,
  decimal: 2,
  porcentaje: 1,
  moneda: 2,
  personalizado: 0,
};

const STACKING_LABEL: Record<StackingMode, string> = {
  ninguno: "Sin apilar (una al lado de otra)",
  apilado: "Apilado",
  porcentaje: "Apilado al 100 %",
};

/** Los ocho colores de serie del tema, por indice. El tema los da; aqui solo se eligen. */
const PALETTE_COLORS = [0, 1, 2, 3, 4, 5, 6, 7];

const POSITION_LABEL: Record<DatumPosition, string> = {
  auto: "Automatica (segun el tipo de grafico)",
  encima: "Encima",
  debajo: "Debajo",
  dentro: "Dentro de la barra",
};

const COMPARISON_LABEL: Record<FunnelComparison, string> = {
  primero: "Contra la primera etapa (cuanto queda)",
  anterior: "Contra la etapa anterior (cuanto se pierde aqui)",
  ninguna: "Sin comparar: solo la cifra",
};

const PIE_LABEL: Record<PieLabel, string> = {
  ninguna: "Sin etiquetas",
  categoria: "Nombre de la categoria",
  valor: "Cifra",
  porcentaje: "Porcentaje",
  "categoria-porcentaje": "Nombre y porcentaje",
};

const LEGEND_LABEL: Record<LegendMode, string> = {
  auto: "Automatica (solo con varias series)",
  oculta: "Oculta",
  arriba: "Arriba",
  abajo: "Abajo",
  izquierda: "A la izquierda",
  derecha: "A la derecha",
};

const KIND_LABEL: Record<FormatKind, string> = {
  general: "General",
  entero: "Entero",
  decimal: "Decimal",
  porcentaje: "Porcentaje",
  moneda: "Moneda",
  personalizado: "Personalizado",
};
