"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PublishBlocker } from "@app/module-model";

/**
 * Lista de modulos del editor — secciones 4.1 y 4.2.
 *
 * Las acciones que se ofrecen son las que el ciclo de vida admite DESDE el estado en que esta
 * cada modulo. Ofrecer "publicar" sobre un borrador y responder 409 al pulsarlo enseña a la
 * gente que los botones mienten; el servidor lo rechaza igual, pero la pantalla no tiene por
 * que proponerlo.
 */

export interface FilaDeModulo {
  moduleId: string;
  slug: string;
  name: string;
  status: "borrador" | "pendiente-de-aprobacion" | "publicado";
  version: number;
  autor: string | null;
  propio: boolean;
  objetos: number;
  bloqueos: PublishBlocker[];
}

const ETIQUETA: Record<FilaDeModulo["status"], string> = {
  borrador: "Borrador",
  "pendiente-de-aprobacion": "Pendiente de aprobacion",
  publicado: "Publicado",
};

export function ListaDeModulos({
  modulos,
  rol,
  usuario,
}: {
  modulos: FilaDeModulo[];
  rol: string;
  usuario: string;
}) {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState("");
  const [trabajando, setTrabajando] = useState(false);

  const esAdmin = rol === "administrador";

  const pedir = async (url: string, init: RequestInit): Promise<boolean> => {
    setError("");
    setTrabajando(true);
    try {
      const r = await fetch(url, {
        ...init,
        headers: {
          "content-type": "application/json",
          ...(init.headers ?? {}),
        },
      });
      if (!r.ok) {
        const cuerpo = (await r.json()) as {
          error?: string;
          detalle?: unknown;
        };
        const detalle = Array.isArray(cuerpo.detalle)
          ? ` ${(cuerpo.detalle as PublishBlocker[]).map((b) => b.detail).join(" ")}`
          : "";
        setError(
          `${cuerpo.error ?? "No se pudo completar la accion."}${detalle}`,
        );
        return false;
      }
      router.refresh();
      return true;
    } finally {
      setTrabajando(false);
    }
  };

  const crear = async () => {
    if (
      await pedir("/api/modulos", {
        method: "POST",
        body: JSON.stringify({ nombre, slug }),
      })
    ) {
      setNombre("");
      setSlug("");
    }
  };

  const transicion = async (
    fila: FilaDeModulo,
    cual: "enviar" | "publicar" | "devolver",
  ) => {
    // Se pide en la propia interfaz porque el servidor lo exige: es lo unico que le dice a quien
    // lo propuso que tiene que cambiar.
    const motivo =
      cual === "devolver"
        ? (window.prompt("Motivo de la devolucion (obligatorio):") ?? "")
        : "";
    if (cual === "devolver" && !motivo.trim()) return;

    await pedir(`/api/modulos/${fila.slug}/estado`, {
      method: "POST",
      body: JSON.stringify({ transicion: cual, ...(motivo ? { motivo } : {}) }),
    });
  };

  return (
    // La lista si tiene tope de ancho: es una tabla, y una linea de tabla muy larga se sigue con
    // el dedo. El lienzo no lo tiene, porque ahi el ancho es sitio para el modulo.
    <section className="editor__lista">
      <h2>Modulos</h2>

      <form
        className="editor__crear"
        onSubmit={(e) => {
          e.preventDefault();
          void crear();
        }}
      >
        <p className="formulario__campo">
          <label htmlFor="nuevo-nombre">Nombre</label>
          <input
            id="nuevo-nombre"
            value={nombre}
            data-testid="nuevo-modulo-nombre"
            onChange={(e) => {
              setNombre(e.target.value);
              // El slug se propone a partir del nombre y se puede corregir: es parte de la URL
              // del modulo (4.11) y tiene que poder elegirse, no quedar atado a un titulo.
              setSlug(
                e.target.value
                  .toLowerCase()
                  .normalize("NFD")
                  .replace(/[̀-ͯ]/g, "")
                  .replace(/[^a-z0-9]+/g, "-")
                  .replace(/^-+|-+$/g, ""),
              );
            }}
          />
        </p>
        <p className="formulario__campo">
          <label htmlFor="nuevo-slug">Slug (parte de la URL)</label>
          <input
            id="nuevo-slug"
            value={slug}
            data-testid="nuevo-modulo-slug"
            onChange={(e) => setSlug(e.target.value)}
          />
        </p>
        <button
          type="submit"
          className="pastilla"
          data-testid="crear-modulo"
          disabled={trabajando}
        >
          Crear borrador
        </button>
      </form>

      <p className="acceso__error" role="alert" data-testid="editor-error">
        {error}
      </p>

      {modulos.length === 0 ? (
        <p className="texto-atenuado">
          No hay ningun modulo que pueda editar. Cree un borrador para empezar.
        </p>
      ) : (
        <div className="tabla-contenedor-datos">
          <table className="tabla-datos" data-testid="lista-modulos">
            <thead>
              <tr>
                <th scope="col">Modulo</th>
                <th scope="col">Estado</th>
                <th scope="col">Autor</th>
                <th scope="col">Objetos</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {modulos.map((m) => {
                // Las mismas tres condiciones que deciden cada boton, reunidas: una celda sin
                // ninguna accion muestra una raya, no un hueco. Un hueco en la ultima columna se
                // lee como algo que falta por cargar.
                const puedeEnviar =
                  m.status === "borrador" && m.autor === usuario;
                const puedePublicar =
                  m.status === "pendiente-de-aprobacion" && esAdmin;
                const puedeDevolver =
                  m.status !== "borrador" && (esAdmin || m.autor === usuario);
                const sinAcciones =
                  !puedeEnviar && !puedePublicar && !puedeDevolver;
                return (
                  <tr key={m.moduleId} data-testid={`fila-${m.slug}`}>
                    <th scope="row">
                      <Link href={`/editor/${m.slug}`}>{m.name}</Link>
                      <span className="texto-atenuado">
                        {" "}
                        /m/{m.slug} · v{m.version}
                      </span>
                    </th>
                    <td>
                      <span className="pastilla-estado" data-estado={m.status}>
                        {ETIQUETA[m.status]}
                      </span>
                      {m.bloqueos.length > 0 ? (
                        <ul
                          className="editor__bloqueos"
                          data-testid={`bloqueos-${m.slug}`}
                        >
                          {m.bloqueos.map((b, i) => (
                            <li key={`${b.reason}-${i}`}>{b.detail}</li>
                          ))}
                        </ul>
                      ) : null}
                    </td>
                    <td>
                      {m.autor ?? (
                        <span className="texto-atenuado">Institucional</span>
                      )}
                    </td>
                    <td>{m.objetos}</td>
                    <td>
                      <div className="editor__acciones">
                        {puedeEnviar ? (
                          <button
                            type="button"
                            className="boton-enlace"
                            data-testid={`enviar-${m.slug}`}
                            disabled={trabajando || m.bloqueos.length > 0}
                            onClick={() => void transicion(m, "enviar")}
                          >
                            Enviar a aprobacion
                          </button>
                        ) : null}

                        {puedePublicar ? (
                          <button
                            type="button"
                            className="pastilla"
                            data-testid={`publicar-${m.slug}`}
                            disabled={trabajando || m.bloqueos.length > 0}
                            onClick={() => void transicion(m, "publicar")}
                          >
                            Publicar
                          </button>
                        ) : null}

                        {puedeDevolver ? (
                          <button
                            type="button"
                            className="boton-enlace"
                            data-testid={`devolver-${m.slug}`}
                            disabled={trabajando}
                            onClick={() => void transicion(m, "devolver")}
                          >
                            {m.status === "publicado"
                              ? "Retirar"
                              : "Devolver a borrador"}
                          </button>
                        ) : null}

                        {sinAcciones ? (
                          <span
                            className="editor__sin-acciones"
                            aria-label="Sin acciones disponibles"
                          >
                            &mdash;
                          </span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
