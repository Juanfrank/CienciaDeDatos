"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PublishBlocker } from "@app/module-model";
import { useTranslator } from '../Locale';

/** Lista de modulos del editor — secciones 4.1 y 4.2. */

export interface ModuleRow {
  moduleId: string;
  slug: string;
  name: string;
  status: "borrador" | "pendiente-de-aprobacion" | "publicado";
  version: number;
  autor: string | null;
  own: boolean;
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
  const t = useTranslator();
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

  const transition = async (
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
      body: JSON.stringify({ transition: cual, ...(motivo ? { motivo } : {}) }),
    });
  };

  return (
    // La lista si tiene tope de ancho: es una tabla, y una linea de tabla muy larga se sigue con
    // el dedo. El lienzo no lo tiene, porque ahi el ancho es sitio para el modulo.
    <section className="editor__list">
      <h2>{t('list.title')}</h2>

      <form
        className="editor__create"
        onSubmit={(e) => {
          e.preventDefault();
          void crear();
        }}
      >
        <p className="form__field">
          <label htmlFor="nuevo-nombre">{t('list.name')}</label>
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
          <label htmlFor="nuevo-slug">{t('list.slug')}</label>
          <input
            id="nuevo-slug"
            value={slug}
            data-testid="new-module-slug"
            onChange={(e) => setSlug(e.target.value)}
          />
        </p>
        <button
          type="submit"
          className="pastilla"
          data-testid="create-module"
          disabled={trabajando}
        >
          {t('list.createDraft')}
        </button>
      </form>

      <p className="login__error" role="alert" data-testid="editor-error">
        {error}
      </p>

      {modules.length === 0 ? (
        <p className="muted-text">
          {t('list.empty')}
        </p>
      ) : (
        <div className="table-container-data">
          <table className="data-table" data-testid="module-list">
            <thead>
              <tr>
                <th scope="col">{t('list.module')}</th>
                <th scope="col">{t('list.status')}</th>
                <th scope="col">{t('list.author')}</th>
                <th scope="col">{t('list.objects')}</th>
                <th scope="col">{t('list.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {modules.map((m) => {
                // Las mismas tres condiciones que deciden cada boton, reunidas: una celda sin
                // ninguna accion muestra una raya, no un hueco. Un hueco en la ultima columna se
                // lee como algo que falta por cargar.
                const sendCan =
                  m.status === "borrador" && m.autor === user;
                const publishCan =
                  m.status === "pendiente-de-aprobacion" && isAdmin;
                const revertCan =
                  m.status !== "borrador" && (isAdmin || m.autor === user);
                const withoutActions =
                  !sendCan && !publishCan && !revertCan;
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
                      <span className="pastilla-estado" data-status={m.status}>
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
                        {sendCan ? (
                          <button
                            type="button"
                            className="button-link"
                            data-testid={`send-${m.slug}`}
                            disabled={trabajando || m.locks.length > 0}
                            onClick={() => void transition(m, "enviar")}
                          >
                            {t('list.submitForApproval')}
                          </button>
                        ) : null}

                        {publishCan ? (
                          <button
                            type="button"
                            className="pastilla"
                            data-testid={`publish-${m.slug}`}
                            disabled={trabajando || m.locks.length > 0}
                            onClick={() => void transition(m, "publicar")}
                          >
                            {t('list.publish')}
                          </button>
                        ) : null}

                        {revertCan ? (
                          <button
                            type="button"
                            className="button-link"
                            data-testid={`revert-${m.slug}`}
                            disabled={trabajando}
                            onClick={() => void transition(m, "devolver")}
                          >
                            {m.status === "publicado"
                              ? "Retirar"
                              : "Devolver a borrador"}
                          </button>
                        ) : null}

                        {withoutActions ? (
                          <span
                            className="editor__without-actions"
                            aria-label={t('list.noActions')}
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
