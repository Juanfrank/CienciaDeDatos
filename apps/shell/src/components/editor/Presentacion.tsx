"use client";

import {
  ACCENTS,
  FUNNEL_COMPARISONS,
  ETIQUETAS_CIRCULARES,
  OBJECT_ICONS,
  MAX_RADIO_INTERIOR,
  STACKING_MODES,
  LEGEND_MODES,
  type SortCriterion,
  type FunnelComparison,
  type PieLabel,
  type StackingMode,
  DATUM_POSITIONS,
  LABEL_POSITIONS,
  etiquetasNormalizadas,
  FORMAT_KINDS,
  PICKER_KINDS,
  problemaDelPatron,
  selectoresEfectivos,
  type ObjectAccent,
  type PresentationKey,
  type DestinoDeTexto,
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
} from "@app/ui-components";
import { Icono } from "../iconos/Icono";
import { Ayuda } from "./Ayuda";
import { EstiloDeTextoEditor, PaletaDeColores } from "./EstiloDeTextoEditor";
import { LineasDeReferencia } from "./LineasDeReferencia";
import { ReglasDeColor } from "./ReglasDeColor";
import { Section } from "./Seccion";

/** Personalizacion de un objeto DESDE el editor — secciones 4.2 y 4.3. */
export function Presentacion({
  instance,
  admitidas,
  kinds,
  guardando,
  onCambiar,
}: {
  instance: ObjectInstance;
  admitidas: PresentationKey[];
  /** Tipo de cada columna del dataset, para ofrecer los selectores que tienen sentido. */
  kinds: Record<string, string>;
  guardando: boolean;
  onCambiar: (cambio: (i: ObjectInstance) => ObjectInstance) => void;
}) {
  const p = instance.presentacion ?? {};
  const admite = (clave: PresentationKey) => admitidas.includes(clave);
  const prueba = `pres-${instance.instanceId}`;

  const poner = (parcial: Partial<ObjectPresentation>) =>
    onCambiar((i) => ({
      ...i,
      presentacion: { ...i.presentacion, ...parcial },
    }));

  /*
   * El estilo de un texto se funde con lo que ya hubiera de los OTROS textos.
   */
  const ponerTexto = (destino: DestinoDeTexto, style: TextStyle) =>
    onCambiar((i) => ({
      ...i,
      presentacion: {
        ...i.presentacion,
        textos: { ...i.presentacion?.textos, [destino]: style },
      },
    }));

  /*
   * Subsecciones, no una tira de veinte controles.
   */
  const hayMedida = admite("formato") || admite("formatos");
  // La forma anterior era un booleano; se normaliza una vez aqui para que el panel no tenga que
  // preguntarse en cada control cual de las dos formas le ha llegado.
  const labels = etiquetasNormalizadas(p.etiquetasDeDato);
  const hayGrafico =
    admite("leyenda") || admite("etiquetasDeDato") || admite("orden") || admite("apilado");
  const esTarjeta = instance.objectId === "tarjeta-kpi";
  const mostrarTitulo = p.mostrarTitulo !== false;

  return (
    <div className="editor__presentacion" data-testid={prueba}>
      <Section
          keys={['titulo', 'subtitulo', 'icono', 'cabecera', 'nombre', 'texto']}
          titulo="Rotulo" nivel={2} prueba={`${prueba}-rotulo`}>
        <label className="editor__interruptor">
          <input
            type="checkbox"
            checked={mostrarTitulo}
            disabled={guardando}
            data-testid={`${prueba}-mostrar-titulo`}
            onChange={(e) => poner({ mostrarTitulo: e.target.checked })}
          />{" "}
          Mostrar titulo
        </label>

        {/*
          El texto del titulo, AQUI y no en la pestana Datos.
          Datos es de donde sale la cifra —dataset, campos, agregacion—; como se rotula es
          formato. Tenerlo repartido obligaba a cambiar de pestana para tocar lo mismo.
        */}
        <label className="formulario__campo">
          <span>Titulo</span>
          <input
            defaultValue={instance.title ?? ""}
            disabled={guardando || !mostrarTitulo}
            data-testid={`${prueba}-titulo-texto`}
            // `onBlur` y no `onChange`: cada cambio guarda el modulo entero contra el servidor.
            onBlur={(e) => onCambiar((i) => ({ ...i, title: e.target.value }))}
          />
        </label>

        {admite("textos") ? (
          <EstiloDeTextoEditor
            titulo="Estilo del titulo"
            style={p.textos?.titulo ?? {}}
            prueba={`${prueba}-texto-titulo`}
            guardando={guardando || !mostrarTitulo}
            onCambiar={(style) => ponerTexto("titulo", style)}
          />
        ) : null}

        {admite("subtitulo") ? (
          <label className="formulario__campo">
            <span>Subtitulo</span>
            <input
              defaultValue={p.subtitulo ?? ""}
              maxLength={80}
              disabled={guardando}
              data-testid={`${prueba}-subtitulo`}
              onBlur={(e) => poner({ subtitulo: e.target.value || undefined })}
            />
          </label>
        ) : null}

        {admite("textos") ? (
          <EstiloDeTextoEditor
            titulo="Estilo del subtitulo"
            style={p.textos?.subtitulo ?? {}}
            prueba={`${prueba}-texto-subtitulo`}
            guardando={guardando}
            onCambiar={(style) => ponerTexto("subtitulo", style)}
          />
        ) : null}

        {admite("mostrarIcono") ? (
          <label className="editor__interruptor">
            <input
              type="checkbox"
              checked={p.mostrarIcono !== false}
              disabled={guardando}
              data-testid={`${prueba}-mostrar-icono`}
              onChange={(e) => poner({ mostrarIcono: e.target.checked })}
            />{" "}
            Mostrar icono
          </label>
        ) : null}

        {admite("icono") ? (
          <label className="formulario__campo">
            <span>Icono</span>
            <span className="editor__icono-elegido">
              {p.icono ? <Icono nombre={p.icono} tamano={18} /> : null}
              <select
                value={p.icono ?? ""}
                disabled={guardando || p.mostrarIcono === false}
                data-testid={`${prueba}-icono`}
                onChange={(e) =>
                  poner({ icono: (e.target.value || undefined) as IconName | undefined })
                }
              >
                <option value="">(el de su tipo)</option>
                {OBJECT_ICONS.map((nombre) => (
                  <option key={nombre} value={nombre}>
                    {nombre}
                  </option>
                ))}
              </select>
            </span>
          </label>
        ) : null}
      </Section>

      {admite("resaltado") || admite("acento") ? (
        <Section
          keys={['resaltado', 'acento', 'color', 'linea', 'marco']}
          titulo="Borde" nivel={2} abierta={false} prueba={`${prueba}-borde`}>
          {admite("acento") ? (
            <label className="formulario__campo">
              <span>Acento</span>
              <select
                value={p.acento ?? "primario"}
                disabled={guardando}
                data-testid={`${prueba}-acento`}
                onChange={(e) => poner({ acento: e.target.value as ObjectAccent })}
              >
                {ACCENTS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {admite("resaltado") ? (
            <>
              <label className="editor__interruptor">
                <input
                  type="checkbox"
                  checked={p.resaltado === true}
                  disabled={guardando}
                  data-testid={`${prueba}-resaltado`}
                  onChange={(e) => poner({ resaltado: e.target.checked })}
                />{" "}
                Linea de resaltado
              </label>
              {p.resaltado ? (
                <div className="formulario__campo">
                  <span>Color del resaltado</span>
                  {/*
                    Aparte del acento a proposito: el acento da el tono general del objeto y el
                    resaltado es una marca de estado —«esto pide atencion»— que a veces tiene que
                    decir algo distinto. «Predeterminado» es «el del acento».
                  */}
                  <PaletaDeColores
                    valor={p.colorDeResaltado ?? "predeterminado"}
                    nombre="la linea de resaltado"
                    prueba={`${prueba}-color-resaltado`}
                    onCambiar={(color) =>
                      poner({ colorDeResaltado: color === "predeterminado" ? undefined : color })
                    }
                  />
                </div>
              ) : null}
            </>
          ) : null}
        </Section>
      ) : null}

      {hayMedida ? (
        <Section
          keys={['formato', 'decimales', 'moneda', 'porcentaje', 'unidad', 'miles', 'cifra', 'numero', 'valor', 'etiqueta']}
          titulo="Medida" nivel={2} abierta={false} prueba={`${prueba}-medida`}>
          <FormatoDeMedidas
            instance={instance}
            guardando={guardando}
            prueba={prueba}
            onCambiar={onCambiar}
          />

          <Section titulo="Valor" nivel={2} abierta={false} prueba={`${prueba}-valor`}>
            {admite("textos") ? (
              <EstiloDeTextoEditor
                titulo="Estilo del valor"
                conVertical={esTarjeta}
                help={
                  esTarjeta
                    ? "La cifra grande. La alineacion vertical la coloca dentro del alto de la tarjeta."
                    : undefined
                }
                style={p.textos?.valor ?? {}}
                prueba={`${prueba}-texto-valor`}
                guardando={guardando}
                onCambiar={(style) => ponerTexto("valor", style)}
              />
            ) : null}
          </Section>

          {esTarjeta ? (
            <Section titulo="Etiqueta" nivel={2} abierta={false} prueba={`${prueba}-etiqueta`}>
              <label className="formulario__campo">
                <span>Texto</span>
                <input
                  defaultValue={p.etiqueta?.content ?? ""}
                  maxLength={40}
                  disabled={guardando}
                  data-testid={`${prueba}-etiqueta-texto`}
                  onBlur={(e) =>
                    poner({ etiqueta: { ...p.etiqueta, content: e.target.value || undefined } })
                  }
                />
              </label>
              <label className="formulario__campo">
                <span>Posicion</span>
                <select
                  value={p.etiqueta?.cellPosition ?? "debajo"}
                  disabled={guardando}
                  data-testid={`${prueba}-etiqueta-posicion`}
                  onChange={(e) =>
                    poner({
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
                <EstiloDeTextoEditor
                  titulo="Estilo de la etiqueta"
                  style={p.textos?.etiqueta ?? {}}
                  prueba={`${prueba}-texto-etiqueta`}
                  guardando={guardando}
                  onCambiar={(style) => ponerTexto("etiqueta", style)}
                />
              ) : null}
            </Section>
          ) : null}
        </Section>
      ) : null}

      {hayGrafico ? (
        <Section
          keys={['leyenda', 'etiquetas de dato', 'apilado', '100 %', 'orden', 'ordenar', 'cifra sobre la barra']}
          titulo="Grafico" nivel={2} abierta={false} prueba={`${prueba}-grafico`}>
          {admite("leyenda") ? (
            <label className="formulario__campo">
              <span>Leyenda</span>
              <select
                value={p.leyenda ?? "auto"}
                disabled={guardando}
                data-testid={`${prueba}-leyenda`}
                onChange={(e) => poner({ leyenda: e.target.value as LegendMode })}
              >
                {LEGEND_MODES.map((m) => (
                  <option key={m} value={m}>
                    {ETIQUETA_DE_LEYENDA[m]}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {admite("etiquetasDeDato") ? (
            <>
              <label className="editor__interruptor">
                <input
                  type="checkbox"
                  checked={labels.mostrar === true}
                  disabled={guardando}
                  data-testid={`${prueba}-etiquetas`}
                  // Se guarda como objeto en cuanto se toca, aunque venga de la forma antigua:
                  // asi la posicion y «solo los extremos» tienen donde vivir desde el primer clic.
                  onChange={(e) => poner({ etiquetasDeDato: { mostrar: e.target.checked } })}
                />{" "}
                Cifra sobre cada barra o punto
              </label>

              {labels.mostrar ? (
                <>
                  <label className="formulario__campo">
                    <span>Donde</span>
                    <select
                      value={labels.cellPosition ?? "auto"}
                      disabled={guardando}
                      data-testid={`${prueba}-posicion-dato`}
                      onChange={(e) =>
                        poner({
                          etiquetasDeDato: {
                            ...labels,
                            cellPosition: e.target.value as DatumPosition,
                          },
                        })
                      }
                    >
                      {DATUM_POSITIONS.map((pos) => (
                        <option key={pos} value={pos}>
                          {ETIQUETA_DE_POSICION[pos]}
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
                      disabled={guardando}
                      data-testid={`${prueba}-solo-extremos`}
                      onChange={(e) =>
                        poner({
                          etiquetasDeDato: { ...labels, onlyEnds: e.target.checked },
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
            <label className="formulario__campo">
              <span>Apilado</span>
              <select
                value={p.apilado ?? "ninguno"}
                disabled={guardando}
                data-testid={`${prueba}-apilado`}
                onChange={(e) => poner({ apilado: e.target.value as StackingMode })}
              >
                {STACKING_MODES.map((m) => (
                  <option key={m} value={m}>
                    {ETIQUETA_DE_APILADO[m]}
                  </option>
                ))}
              </select>
              <span className="campo__pista">
                Al 100 % se compara la composicion de cada categoria, no su magnitud.
              </span>
            </label>
          ) : null}

          {admite("orden") ? (
            <>
              <label className="formulario__campo">
                <span>Ordenar el eje por</span>
                <select
                  value={p.orden?.por ?? "ninguno"}
                  disabled={guardando}
                  data-testid={`${prueba}-orden-por`}
                  onChange={(e) =>
                    poner({
                      orden:
                        e.target.value === "ninguno"
                          ? undefined
                          : { ...p.orden, por: e.target.value as SortCriterion },
                    })
                  }
                >
                  <option value="ninguno">El orden del dataset</option>
                  <option value="categoria">Nombre de la categoria</option>
                  <option value="valor">Valor de la primera medida</option>
                </select>
              </label>

              {p.orden?.por ? (
                <label className="formulario__campo">
                  <span>Direccion</span>
                  <select
                    value={p.orden.direction ?? "asc"}
                    disabled={guardando}
                    data-testid={`${prueba}-orden-direccion`}
                    onChange={(e) =>
                      poner({
                        orden: { ...p.orden, direction: e.target.value as "asc" | "desc" },
                      })
                    }
                  >
                    <option value="asc">Ascendente</option>
                    <option value="desc">Descendente</option>
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
          <p className="campo__pista">
            Ponga una dimension en el pozo «Multiplos», en la pestana Datos, y el objeto se repite
            una vez por cada valor.
          </p>

          <label className="formulario__campo">
            <span>Columnas</span>
            <select
              value={String(p.multiplos?.gridColumns ?? 0)}
              disabled={guardando}
              data-testid={`${prueba}-multiplos-columnas`}
              onChange={(e) =>
                poner({
                  multiplos: {
                    ...p.multiplos,
                    gridColumns: e.target.value === "0" ? undefined : Number(e.target.value),
                  },
                })
              }
            >
              <option value="0">Automaticas</option>
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
              disabled={guardando}
              data-testid={`${prueba}-misma-escala`}
              onChange={(e) =>
                poner({ multiplos: { ...p.multiplos, sameScale: e.target.checked } })
              }
            />{" "}
            Misma escala en todos los paneles
          </label>
          <span className="campo__pista">
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
              disabled={guardando}
              data-testid={`${prueba}-tooltip-total`}
              onChange={(e) => poner({ tooltip: { ...p.tooltip, total: e.target.checked } })}
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
              disabled={guardando}
              data-testid={`${prueba}-tooltip-orden`}
              onChange={(e) =>
                poner({ tooltip: { ...p.tooltip, sortValue: e.target.checked } })
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
          <ReglasDeColor
            rules={p.condicional?.rules ?? []}
            medidas={instance.binding.measures}
            guardando={guardando}
            prueba={`${prueba}-cond`}
            onCambiar={(rules) => poner({ condicional: rules ? { rules } : undefined })}
          />
        </Section>
      ) : null}

      {admite("referencias") ? (
        <Section
          keys={['meta', 'umbral', 'objetivo', 'promedio', 'raya', 'constante']}
          titulo="Lineas de referencia" nivel={2} abierta={false} prueba={`${prueba}-referencias`}>
          <LineasDeReferencia
            lineas={p.referencias ?? []}
            guardando={guardando}
            prueba={`${prueba}-ref`}
            onCambiar={(referencias) => poner({ referencias })}
          />
        </Section>
      ) : null}

      {admite("coloresDeSerie") ? (
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
            <p className="campo__pista">Mapee al menos una medida para poder darle color.</p>
          ) : (
            instance.binding.measures.map((medida, s) => (
              <label key={medida} className="formulario__campo">
                <span>{medida}</span>
                <select
                  value={p.coloresDeSerie?.[s] ?? s}
                  disabled={guardando}
                  data-testid={`${prueba}-color-serie-${s}`}
                  onChange={(e) => {
                    const siguiente = [...(p.coloresDeSerie ?? [])];
                    while (siguiente.length < instance.binding.measures.length) {
                      siguiente.push(siguiente.length);
                    }
                    siguiente[s] = Number(e.target.value);
                    poner({ coloresDeSerie: siguiente });
                  }}
                >
                  {COLORES_DE_PALETA.map((n) => (
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
          <label className="formulario__campo">
            <span>Hueco del centro: {p.circular?.radioInterior ?? 0} %</span>
            <input
              type="range"
              min={0}
              max={MAX_RADIO_INTERIOR}
              step={5}
              value={p.circular?.radioInterior ?? 0}
              disabled={guardando}
              data-testid={`${prueba}-hueco`}
              onChange={(e) =>
                poner({ circular: { ...p.circular, radioInterior: Number(e.target.value) } })
              }
            />
            <span className="campo__pista">0 % es un pastel; 55 % es una dona.</span>
          </label>

          <label className="formulario__campo">
            <span>Etiquetas sobre las porciones</span>
            <select
              value={p.circular?.labels ?? "porcentaje"}
              disabled={guardando}
              data-testid={`${prueba}-etiquetas-circular`}
              onChange={(e) =>
                poner({
                  circular: { ...p.circular, labels: e.target.value as PieLabel },
                })
              }
            >
              {ETIQUETAS_CIRCULARES.map((m) => (
                <option key={m} value={m}>
                  {ETIQUETA_CIRCULAR[m]}
                </option>
              ))}
            </select>
          </label>

          <label className="editor__interruptor">
            <input
              type="checkbox"
              checked={p.circular?.ordenar !== false}
              disabled={guardando}
              data-testid={`${prueba}-ordenar-porciones`}
              onChange={(e) => poner({ circular: { ...p.circular, ordenar: e.target.checked } })}
            />{" "}
            Ordenar de mayor a menor
          </label>

          <label className="editor__interruptor">
            <input
              type="checkbox"
              checked={p.circular?.totalEnElCentro === true}
              disabled={guardando || (p.circular?.radioInterior ?? 0) === 0}
              data-testid={`${prueba}-total-centro`}
              onChange={(e) =>
                poner({ circular: { ...p.circular, totalEnElCentro: e.target.checked } })
              }
            />{" "}
            Total en el centro
          </label>
          {(p.circular?.radioInterior ?? 0) === 0 ? (
            <p className="campo__pista">Sin hueco no hay centro donde escribir el total.</p>
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
          <div className="formulario__pareja">
            <label className="formulario__campo">
              <span>Minimo</span>
              <input
                type="number"
                defaultValue={p.medidor?.minimo ?? ""}
                disabled={guardando}
                data-testid={`${prueba}-minimo`}
                onBlur={(e) =>
                  poner({
                    medidor: {
                      ...p.medidor,
                      minimo: e.target.value === "" ? undefined : Number(e.target.value),
                    },
                  })
                }
              />
            </label>
            <label className="formulario__campo">
              <span>Maximo</span>
              <input
                type="number"
                defaultValue={p.medidor?.maximo ?? ""}
                disabled={guardando}
                data-testid={`${prueba}-maximo`}
                onBlur={(e) =>
                  poner({
                    medidor: {
                      ...p.medidor,
                      maximo: e.target.value === "" ? undefined : Number(e.target.value),
                    },
                  })
                }
              />
            </label>
          </div>
          <span className="campo__pista">
            Vacio = se deduce de los datos, redondeando a una scale estable. Fijarla es lo que
            permite compare dos capturas del mismo medidor.
          </span>

          <label className="formulario__campo">
            <span>Objetivo</span>
            <input
              type="number"
              defaultValue={p.medidor?.objetivo ?? ""}
              disabled={guardando}
              data-testid={`${prueba}-objetivo`}
              onBlur={(e) =>
                poner({
                  medidor: {
                    ...p.medidor,
                    objetivo: e.target.value === "" ? undefined : Number(e.target.value),
                  },
                })
              }
            />
            <span className="campo__pista">
              Solo se usa si el mapeo no trae una medida de objetivo: un dato se actualiza y un
              numero escrito aqui no.
            </span>
          </label>

          <label className="editor__interruptor">
            <input
              type="checkbox"
              checked={p.medidor?.showValue !== false}
              disabled={guardando}
              data-testid={`${prueba}-mostrar-valor`}
              onChange={(e) => poner({ medidor: { ...p.medidor, showValue: e.target.checked } })}
            />{" "}
            Mostrar la cifra bajo la aguja
          </label>
        </Section>
      ) : null}

      {admite("embudo") ? (
        <Section
          keys={['embudo', 'etapa', 'conversion', 'proceso']}
          titulo="Caida" nivel={2} prueba={`${prueba}-embudo`}>
          <label className="formulario__campo">
            <span>Que compara la etiqueta</span>
            <select
              value={p.embudo?.compare ?? "primero"}
              disabled={guardando}
              data-testid={`${prueba}-comparar`}
              onChange={(e) => poner({ embudo: { compare: e.target.value as FunnelComparison } })}
            >
              {FUNNEL_COMPARISONS.map((c) => (
                <option key={c} value={c}>
                  {ETIQUETA_DE_COMPARACION[c]}
                </option>
              ))}
            </select>
            {/*
              Son dos preguntas distintas, no dos formas de decir lo mismo: «cuanto queda de lo
              que entro» y «cuanto se pierde en ESTE paso». Con una sola, la otra hay que
              calcularla de cabeza, que es lo que el objeto viene a evitar.
            */}
            <span className="campo__pista">
              Las etapas nunca se reordenan: su orden es el del proceso.
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
              disabled={guardando}
              data-testid={`${prueba}-mostrar-total`}
              onChange={(e) => poner({ cascada: { showTotal: e.target.checked } })}
            />{" "}
            Barra final con el total
          </label>
          <span className="campo__pista">
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
              disabled={guardando}
              data-testid={`${prueba}-eje-secundario`}
              onChange={(e) => poner({ combinado: { axisSecondary: e.target.checked } })}
            />{" "}
            Medir las lineas en un eje aparte, a la derecha
          </label>
          {/*
            La advertencia va aqui y no en la ayuda del campo, a proposito.
            Dos escalas se pueden elegir para que dos series se crucen donde a uno le convenga, y
            eso es un grafico enganoso. No se impide —hay casos legitimos, y son la razon de ser
            del objeto— pero quien lo enciende tiene que leer que lo esta haciendo.
          */}
          <span className="campo__pista">
            Con dos escalas, una linea por encima de las gridColumns puede valer la mitad. Rotule los
            dos ejes en la seccion «Ejes» para que se pueda leer sin adivinar.
          </span>
        </Section>
      ) : null}

      {admite("ejes") ? (
        <Section
          keys={['eje', 'cuadricula', 'titulo del eje', 'empezar en cero', 'minimo', 'maximo', 'girar', 'rotar']}
          titulo="Ejes" nivel={2} abierta={false} prueba={`${prueba}-ejes`}>
          <label className="editor__interruptor">
            <input
              type="checkbox"
              checked={p.ejes?.mostrarX !== false}
              disabled={guardando}
              data-testid={`${prueba}-eje-x`}
              onChange={(e) => poner({ ejes: { ...p.ejes, mostrarX: e.target.checked } })}
            />{" "}
            Mostrar el eje de categorias
          </label>

          <label className="formulario__campo">
            <span>Titulo del eje de categorias</span>
            <input
              defaultValue={p.ejes?.tituloX ?? ""}
              disabled={guardando}
              data-testid={`${prueba}-titulo-x`}
              onBlur={(e) => poner({ ejes: { ...p.ejes, tituloX: e.target.value || undefined } })}
            />
            {/*
              Se escribe a mano y no sale del nombre del campo: `DimTribunal.Distrito` en un
              objeto de 400 px se recortaba a una letra suelta al borde del grafico.
            */}
            <span className="campo__pista">Vacio = sin titulo.</span>
          </label>

          {p.combinado?.axisSecondary ? (
            <label className="formulario__campo">
              <span>Titulo del eje de la derecha</span>
              <input
                defaultValue={p.ejes?.tituloY2 ?? ""}
                disabled={guardando}
                data-testid={`${prueba}-titulo-y2`}
                onBlur={(e) => poner({ ejes: { ...p.ejes, tituloY2: e.target.value || undefined } })}
              />
              <span className="campo__pista">El que mide las lineas.</span>
            </label>
          ) : null}

          <label className="editor__interruptor">
            <input
              type="checkbox"
              checked={p.ejes?.mostrarY !== false}
              disabled={guardando}
              data-testid={`${prueba}-eje-y`}
              onChange={(e) => poner({ ejes: { ...p.ejes, mostrarY: e.target.checked } })}
            />{" "}
            Mostrar el eje de valores
          </label>

          <label className="formulario__campo">
            <span>Titulo del eje de valores</span>
            <input
              defaultValue={p.ejes?.tituloY ?? ""}
              disabled={guardando}
              data-testid={`${prueba}-titulo-y`}
              onBlur={(e) => poner({ ejes: { ...p.ejes, tituloY: e.target.value || undefined } })}
            />
          </label>

          <label className="editor__interruptor">
            <input
              type="checkbox"
              checked={p.ejes?.gridlines !== false}
              disabled={guardando}
              data-testid={`${prueba}-cuadricula`}
              onChange={(e) => poner({ ejes: { ...p.ejes, gridlines: e.target.checked } })}
            />{" "}
            Lineas de cuadricula
          </label>

          <label className="editor__interruptor">
            <input
              type="checkbox"
              checked={p.ejes?.desdeCero !== false}
              disabled={guardando}
              data-testid={`${prueba}-desde-cero`}
              onChange={(e) => poner({ ejes: { ...p.ejes, desdeCero: e.target.checked } })}
            />{" "}
            Empezar en cero
          </label>
          <p className="campo__pista">
            Un eje que no empieza en cero hace que una diferencia del 2 % parezca el triple.
            Apagarlo deberia ser una decision, no el comportamiento por omision.
          </p>

          {/*
            Vacio NO es cero: vacio es «que lo decida la escala».
            `Number("")` da 0, asi que sin distinguir la cadena vacia, borrar el campo dejaria el
            eje clavado en cero en vez de devolverlo a automatico.
          */}
          <div className="formulario__pareja">
            <label className="formulario__campo">
              <span>Minimo del eje</span>
              <input
                type="number"
                defaultValue={p.ejes?.minimoY ?? ""}
                disabled={guardando}
                data-testid={`${prueba}-minimo-y`}
                onBlur={(e) =>
                  poner({
                    ejes: {
                      ...p.ejes,
                      minimoY: e.target.value === "" ? undefined : Number(e.target.value),
                    },
                  })
                }
              />
            </label>
            <label className="formulario__campo">
              <span>Maximo del eje</span>
              <input
                type="number"
                defaultValue={p.ejes?.maximoY ?? ""}
                disabled={guardando}
                data-testid={`${prueba}-maximo-y`}
                onBlur={(e) =>
                  poner({
                    ejes: {
                      ...p.ejes,
                      maximoY: e.target.value === "" ? undefined : Number(e.target.value),
                    },
                  })
                }
              />
            </label>
          </div>
          <span className="campo__pista">
            Vacio = automatico. Fijarlos es lo que hace comparables dos objetos de la misma medida,
            y tambien la forma mas facil de exagerar una diferencia.
          </span>

          <label className="formulario__campo">
            <span>Girar los rotulos del eje de categorias</span>
            <select
              value={String(p.ejes?.rotarX ?? 0)}
              disabled={guardando}
              data-testid={`${prueba}-rotar-x`}
              onChange={(e) =>
                poner({
                  ejes: {
                    ...p.ejes,
                    rotarX: e.target.value === "0" ? undefined : Number(e.target.value),
                  },
                })
              }
            >
              <option value="0">Horizontales</option>
              <option value="30">30 grados</option>
              <option value="45">45 grados</option>
              <option value="90">Verticales</option>
            </select>
            {/*
              Sin girar, ECharts esconde los rotulos que no caben y el grafico acaba ensenando una
              de cada tres categorias sin decir que las demas siguen ahi. Girados se ven todas.
            */}
            <span className="campo__pista">
              Con nombres largos, en horizontal el grafico esconde los que no caben.
            </span>
          </label>
        </Section>
      ) : null}

      {instance.objectId === "panel-de-filtros" ? (
        <Section
          keys={['filtro', 'panel de filtros', 'desplegable', 'fecha']}
          titulo="Selectores" nivel={2} prueba={`${prueba}-selectores`}>
          <SelectoresDelPanel
            instance={instance}
            kinds={kinds}
            guardando={guardando}
            onCambiar={onCambiar}
          />
        </Section>
      ) : null}

    </div>
  );
}

/** El tipo de selector de cada dimension del panel. */
function SelectoresDelPanel({
  instance,
  kinds,
  guardando,
  onCambiar,
}: {
  instance: ObjectInstance;
  kinds: Record<string, string>;
  guardando: boolean;
  onCambiar: (cambio: (i: ObjectInstance) => ObjectInstance) => void;
}) {
  const settings =
    instance.settings?.objectId === "panel-de-filtros"
      ? instance.settings
      : undefined;
  const efectivos = selectoresEfectivos(instance, settings, kinds);
  const prueba = `selectores-${instance.instanceId}`;

  const ponerTipo = (fieldName: string, tipo: PickerKind) =>
    onCambiar((i) => {
      const previos = (
        i.settings?.objectId === "panel-de-filtros"
          ? i.settings.pickers
          : []
      ).filter((s) => s.fieldName !== fieldName);
      const anterior = efectivos.find((s) => s.fieldName === fieldName);
      return {
        ...i,
        settings: {
          objectId: "panel-de-filtros",
          pickers: [
            ...previos,
            {
              fieldName,
              tipo,
              ...(anterior?.etiqueta ? { etiqueta: anterior.etiqueta } : {}),
            },
          ],
        },
      };
    });

  if (efectivos.length === 0) {
    return (
      <p className="texto-atenuado" data-testid={`${prueba}-vacio`}>
        Marque al menos una dimension arriba para configurar sus selectores.
      </p>
    );
  }

  return (
    <div className="editor__selectores" data-testid={prueba}>
      <p className="texto-atenuado">Como se filtra cada dimension</p>
      {efectivos.map((s) => {
        const columnKind = kinds[s.fieldName] ?? "";
        return (
          <label key={s.fieldName} className="formulario__campo">
            <span>{s.fieldName}</span>
            <select
              value={s.tipo}
              disabled={guardando}
              data-testid={`${prueba}-${s.fieldName}`}
              onChange={(e) =>
                ponerTipo(s.fieldName, e.target.value as PickerKind)
              }
            >
              {PICKER_KINDS.map((t) => (
                <option key={t} value={t} disabled={!aplicaA(t, columnKind)}>
                  {t}
                  {aplicaA(t, columnKind) ? "" : " — necesita una fecha"}
                </option>
              ))}
            </select>
          </label>
        );
      })}
    </div>
  );
}

/** Un selector de fecha sobre una columna que no lo es se ofrece DESHABILITADO, no se esconde. */
function aplicaA(tipo: PickerKind, columnKind: string): boolean {
  if (tipo !== "calendario" && tipo !== "rango-de-fechas") return true;
  return ["date", "datetime", "timestamp", "fecha"].includes(
    columnKind.toLowerCase(),
  );
}

/** El formato de numero, renglon a renglon. */
function FormatoDeMedidas({
  instance,
  guardando,
  prueba,
  onCambiar,
}: {
  instance: ObjectInstance;
  guardando: boolean;
  prueba: string;
  onCambiar: (cambio: (i: ObjectInstance) => ObjectInstance) => void;
}) {
  const formatos = instance.presentacion?.formatos;
  const medidas = instance.binding.measures;

  const ponerFormatos = (siguiente: ObjectFormats) =>
    onCambiar((i) => ({ ...i, presentacion: { ...i.presentacion, formatos: siguiente } }));

  const ponerGeneral = (formato: NumberFormat) =>
    ponerFormatos({ ...formatos, general: formato });

  const ponerMedida = (medida: string, formato: NumberFormat | undefined) => {
    const porMedida = { ...(formatos?.porMedida ?? {}) };
    // Quitar la excepcion se guarda BORRANDO la clave, no copiando el general: si se copiara, la
    // medida dejaria de seguir al general sin que nadie lo hubiera pedido.
    if (formato) porMedida[medida] = formato;
    else delete porMedida[medida];
    ponerFormatos({ ...formatos, porMedida });
  };

  return (
    <>
      <RenglonDeFormato
        titulo="General"
        help="Se aplica a toda medida que no tenga el suyo. Cambiarlo cambia todas a la vez."
        formato={formatos?.general ?? {}}
        prueba={`${prueba}-formato-general`}
        guardando={guardando}
        onCambiar={ponerGeneral}
      />

      {medidas.map((medida) => {
        const propio = formatos?.porMedida?.[medida];
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
                checked={propio !== undefined}
                disabled={guardando}
                data-testid={`${prueba}-excepcion-${medida}`}
                onChange={(e) => ponerMedida(medida, e.target.checked ? { tipo: "general" } : undefined)}
              />{" "}
              Formato propio
            </label>
            {propio ? (
              <RenglonDeFormato
                titulo={`Formato de ${medida}`}
                formato={propio}
                prueba={`${prueba}-formato-m-${medida}`}
                guardando={guardando}
                onCambiar={(formato) => ponerMedida(medida, formato)}
              />
            ) : null}
          </Section>
        );
      })}
    </>
  );
}

/** Un renglon: el tipo y lo que ese tipo necesite. */
function RenglonDeFormato({
  titulo,
  help,
  formato,
  prueba,
  guardando,
  onCambiar,
}: {
  titulo: string;
  help?: string;
  formato: NumberFormat;
  prueba: string;
  guardando: boolean;
  onCambiar: (formato: NumberFormat) => void;
}) {
  const tipo = formato.tipo ?? "general";
  const cambiar = (parcial: Partial<NumberFormat>) => onCambiar({ ...formato, ...parcial });
  const issue = tipo === "personalizado" ? problemaDelPatron(formato.patron ?? "") : null;

  return (
    // El renglon entero lleva identificador, como la paleta y el estilo de texto: preguntar si un
    // objeto deja dar formato a sus cifras no deberia obligar a nombrar el campo de decimales.
    <div className="estilo-texto" data-testid={prueba}>
      <p className="estilo-texto__rotulo">
        {titulo}
        {help ? <Ayuda content={help} de={titulo} /> : null}
      </p>

      <label className="formulario__campo">
        <span>Formato</span>
        <select
          value={tipo}
          disabled={guardando}
          data-testid={`${prueba}-tipo`}
          onChange={(e) => cambiar({ tipo: e.target.value as FormatKind })}
        >
          {FORMAT_KINDS.map((t) => (
            <option key={t} value={t}>
              {ETIQUETA_DE_TIPO[t]}
            </option>
          ))}
        </select>
      </label>

      {tipo === "personalizado" ? (
        <label className="formulario__campo">
          <span>Cadena de formato</span>
          <input
            defaultValue={formato.patron ?? ""}
            placeholder="#,##0.00"
            disabled={guardando}
            data-testid={`${prueba}-patron`}
            aria-describedby={issue ? `${prueba}-patron-error` : undefined}
            aria-invalid={issue ? true : undefined}
            onBlur={(e) => cambiar({ patron: e.target.value })}
          />
          {/*
            El error se dice AQUI y no solo en la lista de bloqueos: quien escribe la cadena esta
            mirando este campo, y mandarle a buscar el motivo arriba del todo es hacerle trabajar
            para descubrir algo que el editor ya sabe.
          */}
          {issue ? (
            <span className="campo__error" id={`${prueba}-patron-error`} role="alert">
              {issue}
            </span>
          ) : (
            <span className="campo__pista">
              <code>0</code> rellena · <code>#</code> no · <code>,</code> millares ·{" "}
              <code>%</code> porcentaje · <code>;</code> separa positivo, negativo y cero
            </span>
          )}
        </label>
      ) : (
        <>
          <label className="formulario__campo">
            <span>Decimales</span>
            <select
              value={String(formato.decimales ?? DECIMALES_POR_DEFECTO[tipo])}
              disabled={guardando || tipo === "entero"}
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
            <label className="formulario__campo">
              <span>Simbolo</span>
              <input
                defaultValue={formato.simbolo ?? "RD$"}
                maxLength={4}
                disabled={guardando}
                data-testid={`${prueba}-simbolo`}
                onBlur={(e) => cambiar({ simbolo: e.target.value || undefined })}
              />
              {/*
                Se escribe y no se elige de una lista: el simbolo de una moneda es una decision de
                la institucion que publica —«RD$», «DOP», «$»— y una lista cerrada obligaria a
                tocar codigo cada vez que alguien reporte en otra divisa.
              */}
              <span className="campo__pista">Precede a la cifra. Por defecto RD$.</span>
            </label>
          ) : null}

          <label className="editor__interruptor">
            <input
              type="checkbox"
              checked={formato.millares !== false}
              disabled={guardando}
              data-testid={`${prueba}-millares`}
              onChange={(e) => cambiar({ millares: e.target.checked })}
            />{" "}
            Separador de miles
          </label>

          <label className="formulario__campo">
            <span>Unidad</span>
            <input
              defaultValue={formato.unit ?? ""}
              maxLength={8}
              disabled={guardando}
              data-testid={`${prueba}-unidad`}
              onBlur={(e) => cambiar({ unit: e.target.value || undefined })}
            />
          </label>

          <label className="editor__interruptor">
            <input
              type="checkbox"
              checked={formato.compacto === true}
              disabled={guardando}
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
const DECIMALES_POR_DEFECTO: Record<FormatKind, number> = {
  general: 0,
  entero: 0,
  decimal: 2,
  porcentaje: 1,
  moneda: 2,
  personalizado: 0,
};

const ETIQUETA_DE_APILADO: Record<StackingMode, string> = {
  ninguno: "Sin apilar (una al lado de otra)",
  apilado: "Apilado",
  porcentaje: "Apilado al 100 %",
};

/** Los ocho colores de serie del tema, por indice. El tema los da; aqui solo se eligen. */
const COLORES_DE_PALETA = [0, 1, 2, 3, 4, 5, 6, 7];

const ETIQUETA_DE_POSICION: Record<DatumPosition, string> = {
  auto: "Automatica (segun el tipo de grafico)",
  encima: "Encima",
  debajo: "Debajo",
  dentro: "Dentro de la barra",
};

const ETIQUETA_DE_COMPARACION: Record<FunnelComparison, string> = {
  primero: "Contra la primera etapa (cuanto queda)",
  anterior: "Contra la etapa anterior (cuanto se pierde aqui)",
  ninguna: "Sin comparar: solo la cifra",
};

const ETIQUETA_CIRCULAR: Record<PieLabel, string> = {
  ninguna: "Sin etiquetas",
  categoria: "Nombre de la categoria",
  valor: "Cifra",
  porcentaje: "Porcentaje",
  "categoria-porcentaje": "Nombre y porcentaje",
};

const ETIQUETA_DE_LEYENDA: Record<LegendMode, string> = {
  auto: "Automatica (solo con varias series)",
  oculta: "Oculta",
  arriba: "Arriba",
  abajo: "Abajo",
  izquierda: "A la izquierda",
  derecha: "A la derecha",
};

const ETIQUETA_DE_TIPO: Record<FormatKind, string> = {
  general: "General",
  entero: "Entero",
  decimal: "Decimal",
  porcentaje: "Porcentaje",
  moneda: "Moneda",
  personalizado: "Personalizado",
};
