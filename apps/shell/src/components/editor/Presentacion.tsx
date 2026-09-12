"use client";

import {
  ACENTOS,
  ICONOS_DE_OBJETO,
  MODOS_DE_LEYENDA,
  TIPOS_DE_SELECTOR,
  selectoresEfectivos,
  type AcentoDeObjeto,
  type ClaveDePresentacion,
  type ModoDeLeyenda,
  type ObjectInstance,
  type NombreDeIcono,
  type PresentacionDeObjeto,
  type TipoDeSelector,
} from "@app/ui-components";
import { Icono } from "../iconos/Icono";
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
   * Subsecciones, no una tira de veinte controles.
   *
   * En un panel de 300 px la rejilla se resuelve en una columna, asi que los siete controles se
   * apilan: quien busca «decimales» recorre todo lo demas primero. Agrupados por lo que hacen
   * —como se rotula, como se formatea la cifra, que muestra el grafico— cada grupo se pliega y lo
   * que no interesa deja de ocupar sitio.
   *
   * Los grupos que un objeto no admite no se dibujan: una tabla no tiene «Grafico».
   */
  const hayCifra = admite("formato");
  const hayGrafico = admite("leyenda") || admite("etiquetasDeDato");

  return (
    <div className="editor__presentacion" data-testid={prueba}>
      <Seccion titulo="Rotulo" nivel={2} prueba={`${prueba}-rotulo`}>
        {admite("icono") ? (
          <label className="formulario__campo">
            <span>Icono</span>
            <span className="editor__icono-elegido">
              {p.icono ? <Icono nombre={p.icono} tamano={18} /> : null}
              <select
                value={p.icono ?? ""}
                disabled={guardando}
                data-testid={`${prueba}-icono`}
                onChange={(e) =>
                  poner({
                    icono: (e.target.value || undefined) as
                      | NombreDeIcono
                      | undefined,
                  })
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

        {admite("acento") ? (
          <label className="formulario__campo">
            <span>Acento</span>
            <select
              value={p.acento ?? "primario"}
              disabled={guardando}
              data-testid={`${prueba}-acento`}
              onChange={(e) =>
                poner({ acento: e.target.value as AcentoDeObjeto })
              }
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
        ) : null}

        {admite("subtitulo") ? (
          <label className="formulario__campo">
            <span>Subtitulo</span>
            <input
              defaultValue={p.subtitulo ?? ""}
              maxLength={80}
              disabled={guardando}
              data-testid={`${prueba}-subtitulo`}
              // `onBlur` y no `onChange`: cada cambio guarda el modulo entero contra el servidor, y
              // con `onChange` eso serian tantas escrituras como letras se teclean.
              onBlur={(e) => poner({ subtitulo: e.target.value || undefined })}
            />
          </label>
        ) : null}
      </Seccion>

      {hayCifra ? (
        <Seccion
          titulo="Cifra"
          nivel={2}
          abierta={false}
          prueba={`${prueba}-cifra`}
        >
          <label className="formulario__campo">
            <span>Decimales</span>
            <select
              value={String(p.formato?.decimales ?? 0)}
              disabled={guardando}
              data-testid={`${prueba}-decimales`}
              onChange={(e) =>
                poner({
                  formato: { ...p.formato, decimales: Number(e.target.value) },
                })
              }
            >
              {[0, 1, 2, 3, 4].map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="formulario__campo">
            <span>Unidad</span>
            <input
              defaultValue={p.formato?.unidad ?? ""}
              maxLength={8}
              disabled={guardando}
              data-testid={`${prueba}-unidad`}
              onBlur={(e) =>
                poner({
                  formato: {
                    ...p.formato,
                    unidad: e.target.value || undefined,
                  },
                })
              }
            />
          </label>
          <label className="editor__interruptor">
            <input
              type="checkbox"
              checked={p.formato?.compacto === true}
              disabled={guardando}
              data-testid={`${prueba}-compacto`}
              onChange={(e) =>
                poner({ formato: { ...p.formato, compacto: e.target.checked } })
              }
            />{" "}
            Compacto (12.5 k)
          </label>
        </Seccion>
      ) : null}

      {hayGrafico ? (
        <Seccion
          titulo="Grafico"
          nivel={2}
          abierta={false}
          prueba={`${prueba}-grafico`}
        >
          {admite("leyenda") ? (
            <label className="formulario__campo">
              <span>Leyenda</span>
              <select
                value={p.leyenda ?? "auto"}
                disabled={guardando}
                data-testid={`${prueba}-leyenda`}
                onChange={(e) =>
                  poner({ leyenda: e.target.value as ModoDeLeyenda })
                }
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
