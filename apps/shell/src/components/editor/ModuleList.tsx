"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PublishBlocker } from "@app/module-model";

/** Lista de modulos del editor — secciones 4.1 y 4.2. */

export interface ModuleRow {
  moduleId: string;
  slug: string;
  name: string;
  status: "borrador" | "pendiente-de-aprobacion" | "publicado";
  version: number;
  autor: string | null;
  propio: boolean;
  objetos: number;
  locks: PublishBlocker[];
}

const LABEL: Record<ModuleRow["status"], string> = {
  borrador: "Borrador",
  "pendiente-de-aprobacion": "Pendiente de aprobacion",
  publicado: "Publicado",
};

export function ModuleList({
  modules,
  role,
  user,
}: {
  modules: ModuleRow[];
  role: string;
  user: string;
}) {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState("");
  const [trabajando, setTrabajando] = useState(false);

  const isAdmin = role === "administrador";

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
        const body = (await r.json()) as {
          error?: string;
          detalle?: unknown;
        };
        const detalle = Array.isArray(body.detalle)
          ? ` ${(body.detalle as PublishBlocker[]).map((b) => b.detail).join(" ")}`
          : "";
        setError(
          `${body.error ?? "No se pudo completar la accion."}${detalle}`,
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
    fila: ModuleRow,
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
    <section className="editor__list">
      <h2>Modulos</h2>

      <form
        className="editor__create"
        onSubmit={(e) => {
          e.preventDefault();
          void crear();
        }}
      >
        <p className="form__field">
          <label htmlFor="nuevo-nombre">Nombre</label>
          <input
            id="nuevo-nombre"
            value={nombre}
            data-testid="new-module-name"
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
        <p className="form__field">
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
          data-testid="create-module"
          disabled={trabajando}
        >
          Crear borrador
        </button>
      </form>

      <p className="login__error" role="alert" data-testid="editor-error">
        {error}
      </p>

      {modules.length === 0 ? (
        <p className="muted-text">
          No hay ningun modulo que pueda editar. Cree un borrador para empezar.
        </p>
      ) : (
        <div className="table-container-data">
          <table className="data-table" data-testid="module-list">
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
              {modules.map((m) => {
                // Las mismas tres condiciones que deciden cada boton, reunidas: una celda sin
                // ninguna accion muestra una raya, no un hueco. Un hueco en la ultima columna se
                // lee como algo que falta por cargar.
                const puedeEnviar =
                  m.status === "borrador" && m.autor === user;
                const puedePublicar =
                  m.status === "pendiente-de-aprobacion" && isAdmin;
                const puedeDevolver =
                  m.status !== "borrador" && (isAdmin || m.autor === user);
                const withoutActions =
                  !puedeEnviar && !puedePublicar && !puedeDevolver;
                return (
                  <tr key={m.moduleId} data-testid={`row-${m.slug}`}>
                    <th scope="row">
                      <Link href={`/editor/${m.slug}`}>{m.name}</Link>
                      <span className="muted-text">
                        {" "}
                        /m/{m.slug} · v{m.version}
                      </span>
                    </th>
                    <td>
                      <span className="pastilla-estado" status-data={m.status}>
                        {LABEL[m.status]}
                      </span>
                      {m.locks.length > 0 ? (
                        <ul
                          className="editor__locks"
                          data-testid={`locks-${m.slug}`}
                        >
                          {m.locks.map((b, i) => (
                            <li key={`${b.reason}-${i}`}>{b.detail}</li>
                          ))}
                        </ul>
                      ) : null}
                    </td>
                    <td>
                      {m.autor ?? (
                        <span className="muted-text">Institucional</span>
                      )}
                    </td>
                    <td>{m.objetos}</td>
                    <td>
                      <div className="editor__actions">
                        {puedeEnviar ? (
                          <button
                            type="button"
                            className="boton-enlace"
                            data-testid={`send-${m.slug}`}
                            disabled={trabajando || m.locks.length > 0}
                            onClick={() => void transicion(m, "enviar")}
                          >
                            Enviar a aprobacion
                          </button>
                        ) : null}

                        {puedePublicar ? (
                          <button
                            type="button"
                            className="pastilla"
                            data-testid={`publish-${m.slug}`}
                            disabled={trabajando || m.locks.length > 0}
                            onClick={() => void transicion(m, "publicar")}
                          >
                            Publicar
                          </button>
                        ) : null}

                        {puedeDevolver ? (
                          <button
                            type="button"
                            className="boton-enlace"
                            data-testid={`revert-${m.slug}`}
                            disabled={trabajando}
                            onClick={() => void transicion(m, "devolver")}
                          >
                            {m.status === "publicado"
                              ? "Retirar"
                              : "Devolver a borrador"}
                          </button>
                        ) : null}

                        {withoutActions ? (
                          <span
                            className="editor__without-actions"
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
