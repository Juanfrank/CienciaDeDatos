"use client";

import {
  ACENTOS,
  COMPARACIONES_DE_EMBUDO,
  ETIQUETAS_CIRCULARES,
  ICONOS_DE_OBJETO,
  MAX_RADIO_INTERIOR,
  MODOS_DE_APILADO,
  MODOS_DE_LEYENDA,
  type CriterioDeOrden,
  type ComparacionDeEmbudo,
  type EtiquetaCircular,
  type ModoDeApilado,
  POSICIONES_DE_ETIQUETA,
  TIPOS_DE_FORMATO,
  TIPOS_DE_SELECTOR,
  problemaDelPatron,
  selectoresEfectivos,
  type AcentoDeObjeto,
  type ClaveDePresentacion,
  type DestinoDeTexto,
  type EstiloDeTexto,
  type FormatoDeNumero,
  type FormatosDelObjeto,
  type ModoDeLeyenda,
  type PosicionDeEtiqueta,
  type TipoDeFormato,
  type ObjectInstance,
  type NombreDeIcono,
  type PresentacionDeObjeto,
  type TipoDeSelector,
} from "@app/ui-components";
import { Icono } from "../iconos/Icono";
import { Ayuda } from "./Ayuda";
import { EstiloDeTextoEditor, PaletaDeColores } from "./EstiloDeTextoEditor";
import { Seccion } from "./Seccion";

/**
 * Personalizacion de un objeto DESDE el editor — secciones 4.2 y 4.3.
 *
 * Esto es lo que hace que «la misma tarjeta pero en rojo, con otro icono y con la cifra en
 * porcentaje» deje de ser una peticion de desarrollo. Antes, cambiar cualquiera de esas tres
 * cosas significaba tocar codigo y desplegar.
 *
 * Lo que NO hay aqui, y es deliberado: ninguna caja donde escribir un color, una ruta SVG o un
 * formato libre. Cada control ofrece un conjunto CERRADO de valores que salen del contrato, por
 * el mismo motivo por el que no hay una caja para escribir SQL. Un hexadecimal escrito a mano
 * seria un color que la puerta de contraste de 4.3 no ha comprobado nunca, y una ruta SVG pegada
 * seria contenido sin revisar dentro del documento.
 *
 * Solo se dibujan las claves que ESTE objeto declara admitir. Ofrecer «leyenda» en una tabla
 * guardaria una opcion que no hace nada, y esa es la configuracion que luego nadie se atreve a
 * borrar por si acaso sirve para algo.
 */
export function Presentacion({
  instance,
  admitidas,
  tipos,
  guardando,
  onCambiar,
}: {
  instance: ObjectInstance;
  admitidas: ClaveDePresentacion[];
  /** Tipo de cada columna del dataset, para ofrecer los selectores que tienen sentido. */
  tipos: Record<string, string>;
  guardando: boolean;
  onCambiar: (cambio: (i: ObjectInstance) => ObjectInstance) => void;
}) {
  const p = instance.presentacion ?? {};
  const admite = (clave: ClaveDePresentacion) => admitidas.includes(clave);
  const prueba = `pres-${instance.instanceId}`;

  const poner = (parcial: Partial<PresentacionDeObjeto>) =>
    onCambiar((i) => ({
      ...i,
      presentacion: { ...i.presentacion, ...parcial },
    }));

  /*
   * El estilo de un texto se funde con lo que ya hubiera de los OTROS textos.
   *
   * Sin el `...i.presentacion?.textos`, configurar la cifra borraria lo que se hubiera puesto en
   * el titulo: el objeto entero se reemplazaria por el del ultimo destino tocado.
   */
  const ponerTexto = (destino: DestinoDeTexto, estilo: EstiloDeTexto) =>
    onCambiar((i) => ({
      ...i,
      presentacion: {
        ...i.presentacion,
        textos: { ...i.presentacion?.textos, [destino]: estilo },
      },
    }));

  /*
   * Subsecciones, no una tira de veinte controles.
   *
   * En un panel de 340 px todo se apila en una columna, asi que quien busca «decimales» recorre
   * lo demas primero. Agrupadas por lo que hacen, cada una se pliega y lo que no interesa deja de
   * ocupar sitio. Los grupos que un objeto no admite no se dibujan: una tabla no tiene «Grafico».
   *
   * Secciones por lo que hacen, no por lo que son.
   *
   * «Rotulo» reune TODO lo que rotula el objeto —titulo, subtitulo, icono— con su texto y su
   * estilo juntos. Antes el texto del titulo vivia en la pestana Datos y su estilo en Formato,
   * asi que cambiar como se ve un titulo obligaba a ir y venir entre dos pestanas para tocar la
   * misma cosa. «Borde» agrupa lo que dibuja el limite de la tarjeta. «Medida» es lo que hace la
   * cifra: el valor y la etiqueta que lo acompana.
   */
  const hayMedida = admite("formato") || admite("formatos");
  const hayGrafico =
    admite("leyenda") || admite("etiquetasDeDato") || admite("orden") || admite("apilado");
  const esTarjeta = instance.objectId === "tarjeta-kpi";
  const mostrarTitulo = p.mostrarTitulo !== false;

  return (
    <div className="editor__presentacion" data-testid={prueba}>
      <Seccion titulo="Rotulo" nivel={2} prueba={`${prueba}-rotulo`}>
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
            estilo={p.textos?.titulo ?? {}}
            prueba={`${prueba}-texto-titulo`}
            guardando={guardando || !mostrarTitulo}
            onCambiar={(estilo) => ponerTexto("titulo", estilo)}
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
            estilo={p.textos?.subtitulo ?? {}}
            prueba={`${prueba}-texto-subtitulo`}
            guardando={guardando}
            onCambiar={(estilo) => ponerTexto("subtitulo", estilo)}
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
                  poner({ icono: (e.target.value || undefined) as NombreDeIcono | undefined })
                }
              >
                <option value="">(el de su tipo)</option>
                {ICONOS_DE_OBJETO.map((nombre) => (
                  <option key={nombre} value={nombre}>
                    {nombre}
                  </option>
                ))}
              </select>
            </span>
          </label>
        ) : null}
      </Seccion>

      {admite("resaltado") || admite("acento") ? (
        <Seccion titulo="Borde" nivel={2} abierta={false} prueba={`${prueba}-borde`}>
          {admite("acento") ? (
            <label className="formulario__campo">
              <span>Acento</span>
              <select
                value={p.acento ?? "primario"}
                disabled={guardando}
                data-testid={`${prueba}-acento`}
                onChange={(e) => poner({ acento: e.target.value as AcentoDeObjeto })}
              >
                {ACENTOS.map((a) => (
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
        </Seccion>
      ) : null}

      {hayMedida ? (
        <Seccion titulo="Medida" nivel={2} abierta={false} prueba={`${prueba}-medida`}>
          <FormatoDeMedidas
            instance={instance}
            guardando={guardando}
            prueba={prueba}
            onCambiar={onCambiar}
          />

          <Seccion titulo="Valor" nivel={2} abierta={false} prueba={`${prueba}-valor`}>
            {admite("textos") ? (
              <EstiloDeTextoEditor
                titulo="Estilo del valor"
                conVertical={esTarjeta}
                ayuda={
                  esTarjeta
                    ? "La cifra grande. La alineacion vertical la coloca dentro del alto de la tarjeta."
                    : undefined
                }
                estilo={p.textos?.valor ?? {}}
                prueba={`${prueba}-texto-valor`}
                guardando={guardando}
                onCambiar={(estilo) => ponerTexto("valor", estilo)}
              />
            ) : null}
          </Seccion>

          {esTarjeta ? (
            <Seccion titulo="Etiqueta" nivel={2} abierta={false} prueba={`${prueba}-etiqueta`}>
              <label className="formulario__campo">
                <span>Texto</span>
                <input
                  defaultValue={p.etiqueta?.texto ?? ""}
                  maxLength={40}
                  disabled={guardando}
                  data-testid={`${prueba}-etiqueta-texto`}
                  onBlur={(e) =>
                    poner({ etiqueta: { ...p.etiqueta, texto: e.target.value || undefined } })
                  }
                />
              </label>
              <label className="formulario__campo">
                <span>Posicion</span>
                <select
                  value={p.etiqueta?.posicion ?? "debajo"}
                  disabled={guardando}
                  data-testid={`${prueba}-etiqueta-posicion`}
                  onChange={(e) =>
                    poner({
                      etiqueta: {
                        ...p.etiqueta,
                        posicion: e.target.value as PosicionDeEtiqueta,
                      },
                    })
                  }
                >
                  {POSICIONES_DE_ETIQUETA.map((pos) => (
                    <option key={pos} value={pos}>
                      {pos === "encima" ? "Encima del valor" : "Debajo del valor"}
                    </option>
                  ))}
                </select>
              </label>
              {admite("textos") ? (
                <EstiloDeTextoEditor
                  titulo="Estilo de la etiqueta"
                  estilo={p.textos?.etiqueta ?? {}}
                  prueba={`${prueba}-texto-etiqueta`}
                  guardando={guardando}
                  onCambiar={(estilo) => ponerTexto("etiqueta", estilo)}
                />
              ) : null}
            </Seccion>
          ) : null}
        </Seccion>
      ) : null}

      {hayGrafico ? (
        <Seccion titulo="Grafico" nivel={2} abierta={false} prueba={`${prueba}-grafico`}>
          {admite("leyenda") ? (
            <label className="formulario__campo">
              <span>Leyenda</span>
              <select
                value={p.leyenda ?? "auto"}
                disabled={guardando}
                data-testid={`${prueba}-leyenda`}
                onChange={(e) => poner({ leyenda: e.target.value as ModoDeLeyenda })}
              >
                {MODOS_DE_LEYENDA.map((m) => (
                  <option key={m} value={m}>
                    {ETIQUETA_DE_LEYENDA[m]}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {admite("etiquetasDeDato") ? (
            <label className="editor__interruptor">
              <input
                type="checkbox"
                checked={p.etiquetasDeDato === true}
                disabled={guardando}
                data-testid={`${prueba}-etiquetas`}
                onChange={(e) => poner({ etiquetasDeDato: e.target.checked })}
              />{" "}
              Cifra sobre cada barra o punto
            </label>
          ) : null}

          {admite("apilado") ? (
            <label className="formulario__campo">
              <span>Apilado</span>
              <select
                value={p.apilado ?? "ninguno"}
                disabled={guardando}
                data-testid={`${prueba}-apilado`}
                onChange={(e) => poner({ apilado: e.target.value as ModoDeApilado })}
              >
                {MODOS_DE_APILADO.map((m) => (
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
                          : { ...p.orden, por: e.target.value as CriterioDeOrden },
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
                    value={p.orden.direccion ?? "asc"}
                    disabled={guardando}
                    data-testid={`${prueba}-orden-direccion`}
                    onChange={(e) =>
                      poner({
                        orden: { ...p.orden, direccion: e.target.value as "asc" | "desc" },
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
        </Seccion>
      ) : null}

      {admite("circular") ? (
        <Seccion titulo="Porciones" nivel={2} prueba={`${prueba}-circular`}>
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
              value={p.circular?.etiquetas ?? "porcentaje"}
              disabled={guardando}
              data-testid={`${prueba}-etiquetas-circular`}
              onChange={(e) =>
                poner({
                  circular: { ...p.circular, etiquetas: e.target.value as EtiquetaCircular },
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
        </Seccion>
      ) : null}

      {admite("medidor") ? (
        <Seccion titulo="Escala" nivel={2} prueba={`${prueba}-medidor`}>
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
            Vacio = se deduce de los datos, redondeando a una escala estable. Fijarla es lo que
            permite comparar dos capturas del mismo medidor.
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
              checked={p.medidor?.mostrarValor !== false}
              disabled={guardando}
              data-testid={`${prueba}-mostrar-valor`}
              onChange={(e) => poner({ medidor: { ...p.medidor, mostrarValor: e.target.checked } })}
            />{" "}
            Mostrar la cifra bajo la aguja
          </label>
        </Seccion>
      ) : null}

      {admite("embudo") ? (
        <Seccion titulo="Caida" nivel={2} prueba={`${prueba}-embudo`}>
          <label className="formulario__campo">
            <span>Que compara la etiqueta</span>
            <select
              value={p.embudo?.comparar ?? "primero"}
              disabled={guardando}
              data-testid={`${prueba}-comparar`}
              onChange={(e) => poner({ embudo: { comparar: e.target.value as ComparacionDeEmbudo } })}
            >
              {COMPARACIONES_DE_EMBUDO.map((c) => (
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
        </Seccion>
      ) : null}

      {admite("cascada") ? (
        <Seccion titulo="Cascada" nivel={2} prueba={`${prueba}-cascada`}>
          <label className="editor__interruptor">
            <input
              type="checkbox"
              checked={p.cascada?.mostrarTotal !== false}
              disabled={guardando}
              data-testid={`${prueba}-mostrar-total`}
              onChange={(e) => poner({ cascada: { mostrarTotal: e.target.checked } })}
            />{" "}
            Barra final con el total
          </label>
          <span className="campo__pista">
            El signo va SIEMPRE en la etiqueta: el color distingue subida de bajada, pero no puede
            ser el unico medio de decirlo.
          </span>
        </Seccion>
      ) : null}

      {admite("combinado") ? (
        <Seccion titulo="Ejes de valor" nivel={2} prueba={`${prueba}-combinado`}>
          <label className="editor__interruptor">
            <input
              type="checkbox"
              checked={p.combinado?.ejeSecundario === true}
              disabled={guardando}
              data-testid={`${prueba}-eje-secundario`}
              onChange={(e) => poner({ combinado: { ejeSecundario: e.target.checked } })}
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
            Con dos escalas, una linea por encima de las columnas puede valer la mitad. Rotule los
            dos ejes en la seccion «Ejes» para que se pueda leer sin adivinar.
          </span>
        </Seccion>
      ) : null}

      {admite("ejes") ? (
        <Seccion titulo="Ejes" nivel={2} abierta={false} prueba={`${prueba}-ejes`}>
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

          {p.combinado?.ejeSecundario ? (
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
              checked={p.ejes?.cuadricula !== false}
              disabled={guardando}
              data-testid={`${prueba}-cuadricula`}
              onChange={(e) => poner({ ejes: { ...p.ejes, cuadricula: e.target.checked } })}
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
        </Seccion>
      ) : null}

      {instance.objectId === "panel-de-filtros" ? (
        <Seccion titulo="Selectores" nivel={2} prueba={`${prueba}-selectores`}>
          <SelectoresDelPanel
            instance={instance}
            tipos={tipos}
            guardando={guardando}
            onCambiar={onCambiar}
          />
        </Seccion>
      ) : null}
    </div>
  );
}

/**
 * El tipo de selector de cada dimension del panel.
 *
 * Se dibuja una fila por dimension MAPEADA, no una por selector configurado: asi anadir una
 * dimension al panel la hace aparecer aqui con su valor por defecto, y no queda ninguna sin
 * configurar y por tanto invisible.
 */
function SelectoresDelPanel({
  instance,
  tipos,
  guardando,
  onCambiar,
}: {
  instance: ObjectInstance;
  tipos: Record<string, string>;
  guardando: boolean;
  onCambiar: (cambio: (i: ObjectInstance) => ObjectInstance) => void;
}) {
  const configuracion =
    instance.configuracion?.objectId === "panel-de-filtros"
      ? instance.configuracion
      : undefined;
  const efectivos = selectoresEfectivos(instance, configuracion, tipos);
  const prueba = `selectores-${instance.instanceId}`;

  const ponerTipo = (campo: string, tipo: TipoDeSelector) =>
    onCambiar((i) => {
      const previos = (
        i.configuracion?.objectId === "panel-de-filtros"
          ? i.configuracion.selectores
          : []
      ).filter((s) => s.campo !== campo);
      const anterior = efectivos.find((s) => s.campo === campo);
      return {
        ...i,
        configuracion: {
          objectId: "panel-de-filtros",
          selectores: [
            ...previos,
            {
              campo,
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
        const tipoDeColumna = tipos[s.campo] ?? "";
        return (
          <label key={s.campo} className="formulario__campo">
            <span>{s.campo}</span>
            <select
              value={s.tipo}
              disabled={guardando}
              data-testid={`${prueba}-${s.campo}`}
              onChange={(e) =>
                ponerTipo(s.campo, e.target.value as TipoDeSelector)
              }
            >
              {TIPOS_DE_SELECTOR.map((t) => (
                <option key={t} value={t} disabled={!aplicaA(t, tipoDeColumna)}>
                  {t}
                  {aplicaA(t, tipoDeColumna) ? "" : " — necesita una fecha"}
                </option>
              ))}
            </select>
          </label>
        );
      })}
    </div>
  );
}

/**
 * Un selector de fecha sobre una columna que no lo es se ofrece DESHABILITADO, no se esconde.
 *
 * Esconderlo dejaria a quien edita preguntandose por que el calendario existe en otro panel y no
 * en este. Deshabilitado con su motivo al lado, la respuesta esta donde surge la pregunta — y la
 * validacion del servidor lo rechazaria igual, asi que nada depende de este control.
 */
function aplicaA(tipo: TipoDeSelector, tipoDeColumna: string): boolean {
  if (tipo !== "calendario" && tipo !== "rango-de-fechas") return true;
  return ["date", "datetime", "timestamp", "fecha"].includes(
    tipoDeColumna.toLowerCase(),
  );
}

/**
 * El formato de numero, renglon a renglon.
 *
 * Un renglon GENERAL y uno por cada medida mapeada. El general no es un valor por defecto que se
 * copie a cada medida: es la regla que se consulta cuando la medida no dice nada, asi que
 * cambiarlo cambia todas las que nadie haya tocado — que es lo que uno espera de «general». Una
 * medida solo aparece con formato propio si alguien se lo pone, y se puede devolver al general
 * quitandoselo.
 */
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

  const ponerFormatos = (siguiente: FormatosDelObjeto) =>
    onCambiar((i) => ({ ...i, presentacion: { ...i.presentacion, formatos: siguiente } }));

  const ponerGeneral = (formato: FormatoDeNumero) =>
    ponerFormatos({ ...formatos, general: formato });

  const ponerMedida = (medida: string, formato: FormatoDeNumero | undefined) => {
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
        ayuda="Se aplica a toda medida que no tenga el suyo. Cambiarlo cambia todas a la vez."
        formato={formatos?.general ?? {}}
        prueba={`${prueba}-formato-general`}
        guardando={guardando}
        onCambiar={ponerGeneral}
      />

      {medidas.map((medida) => {
        const propio = formatos?.porMedida?.[medida];
        return (
          <Seccion
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
          </Seccion>
        );
      })}
    </>
  );
}

/** Un renglon: el tipo y lo que ese tipo necesite. */
function RenglonDeFormato({
  titulo,
  ayuda,
  formato,
  prueba,
  guardando,
  onCambiar,
}: {
  titulo: string;
  ayuda?: string;
  formato: FormatoDeNumero;
  prueba: string;
  guardando: boolean;
  onCambiar: (formato: FormatoDeNumero) => void;
}) {
  const tipo = formato.tipo ?? "general";
  const cambiar = (parcial: Partial<FormatoDeNumero>) => onCambiar({ ...formato, ...parcial });
  const problema = tipo === "personalizado" ? problemaDelPatron(formato.patron ?? "") : null;

  return (
    <div className="estilo-texto">
      <p className="estilo-texto__rotulo">
        {titulo}
        {ayuda ? <Ayuda texto={ayuda} de={titulo} /> : null}
      </p>

      <label className="formulario__campo">
        <span>Formato</span>
        <select
          value={tipo}
          disabled={guardando}
          data-testid={`${prueba}-tipo`}
          onChange={(e) => cambiar({ tipo: e.target.value as TipoDeFormato })}
        >
          {TIPOS_DE_FORMATO.map((t) => (
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
            aria-describedby={problema ? `${prueba}-patron-error` : undefined}
            aria-invalid={problema ? true : undefined}
            onBlur={(e) => cambiar({ patron: e.target.value })}
          />
          {/*
            El error se dice AQUI y no solo en la lista de bloqueos: quien escribe la cadena esta
            mirando este campo, y mandarle a buscar el motivo arriba del todo es hacerle trabajar
            para descubrir algo que el editor ya sabe.
          */}
          {problema ? (
            <span className="campo__error" id={`${prueba}-patron-error`} role="alert">
              {problema}
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
              defaultValue={formato.unidad ?? ""}
              maxLength={8}
              disabled={guardando}
              data-testid={`${prueba}-unidad`}
              onBlur={(e) => cambiar({ unidad: e.target.value || undefined })}
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
const DECIMALES_POR_DEFECTO: Record<TipoDeFormato, number> = {
  general: 0,
  entero: 0,
  decimal: 2,
  porcentaje: 1,
  moneda: 2,
  personalizado: 0,
};

const ETIQUETA_DE_APILADO: Record<ModoDeApilado, string> = {
  ninguno: "Sin apilar (una al lado de otra)",
  apilado: "Apilado",
  porcentaje: "Apilado al 100 %",
};

const ETIQUETA_DE_COMPARACION: Record<ComparacionDeEmbudo, string> = {
  primero: "Contra la primera etapa (cuanto queda)",
  anterior: "Contra la etapa anterior (cuanto se pierde aqui)",
  ninguna: "Sin comparar: solo la cifra",
};

const ETIQUETA_CIRCULAR: Record<EtiquetaCircular, string> = {
  ninguna: "Sin etiquetas",
  categoria: "Nombre de la categoria",
  valor: "Cifra",
  porcentaje: "Porcentaje",
  "categoria-porcentaje": "Nombre y porcentaje",
};

const ETIQUETA_DE_LEYENDA: Record<ModoDeLeyenda, string> = {
  auto: "Automatica (solo con varias series)",
  oculta: "Oculta",
  arriba: "Arriba",
  abajo: "Abajo",
  izquierda: "A la izquierda",
  derecha: "A la derecha",
};

const ETIQUETA_DE_TIPO: Record<TipoDeFormato, string> = {
  general: "General",
  entero: "Entero",
  decimal: "Decimal",
  porcentaje: "Porcentaje",
  moneda: "Moneda",
  personalizado: "Personalizado",
};
