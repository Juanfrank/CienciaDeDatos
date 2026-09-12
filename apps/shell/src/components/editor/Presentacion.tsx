"use client";

import {
  ACENTOS,
  ICONOS_DE_OBJETO,
  MODOS_DE_LEYENDA,
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
  const hayGrafico = admite("leyenda") || admite("etiquetasDeDato");
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
                    {m}
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
              Cifra sobre cada barra
            </label>
          ) : null}
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

const ETIQUETA_DE_TIPO: Record<TipoDeFormato, string> = {
  general: "General",
  entero: "Entero",
  decimal: "Decimal",
  porcentaje: "Porcentaje",
  moneda: "Moneda",
  personalizado: "Personalizado",
};
