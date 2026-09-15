"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { LocalAccountStatus } from "../../server/identity";

/** Cuentas locales y sus dos vias de recuperacion — seccion 4.7.2. */
export function LocalesAccounts({
  accounts,
  canal,
  availableMail,
}: {
  accounts: LocalAccountStatus[];
  canal: string;
  availableMail: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [emitido, setEmitido] = useState<{
    email: string;
    resetId: string;
    code?: string;
    expiraEn: string;
  } | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  const actuar = async (
    accion: "desbloquear" | "restablecer",
    email: string,
  ) => {
    setError("");
    setEmitido(null);
    setTrabajando(true);
    try {
      const r = await fetch("/api/admin/accounts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accion, email }),
      });
      const body = (await r.json()) as {
        error?: string;
        resetId?: string;
        code?: string;
        expiraEn?: string;
      };

      if (!r.ok) {
        setError(body.error ?? "No se pudo completar la accion.");
        return;
      }
      if (accion === "restablecer" && body.resetId) {
        setEmitido({
          email,
          resetId: body.resetId,
          ...(body.code ? { code: body.code } : {}),
          expiraEn: body.expiraEn ?? "",
        });
      }
      router.refresh();
    } finally {
      setTrabajando(false);
    }
  };

  return (
    <>
      <p
        className={
          availableMail ? "aviso notice-ok" : "aviso notice-atencion"
        }
        data-testid="canal-restablecimiento"
      >
        Canal de entrega del token: <strong>{canal}</strong>.{" "}
        {availableMail
          ? "El token se envia al correo verificado de la cuenta."
          : "Sin correo institucional configurado, el restablecimiento es MEDIADO: el codigo se " +
            "muestra aqui y usted lo entrega a la persona por una via en la que haya verificado " +
            "su identidad. Usted responde de esa verificacion."}
      </p>

      <p className="aviso-error" role="alert" data-testid="accounts-error">
        {error}
      </p>

      {emitido ? (
        <div
          className="aviso notice-atencion"
          data-testid="restablecimiento-emitido"
        >
          <p>
            Restablecimiento para <strong>{emitido.email}</strong>. Caduca el{" "}
            {new Date(emitido.expiraEn).toLocaleString("es-DO")} y solo se puede
            usar una vez.
          </p>
          <p>
            Identificador: <code data-testid="reset-id">{emitido.resetId}</code>
          </p>
          {emitido.code ? (
            <p>
              Codigo: <code data-testid="reset-code">{emitido.code}</code>
            </p>
          ) : null}
          <p className="muted-text">
            La persona entra en /reset con estos dos datos y elige su
            contrasena new. Al hacerlo se le desbloquea la cuenta y se cierran
            sus sessions abiertas.
          </p>
        </div>
      ) : null}

      <div className="table-container-data">
        <table className="data-table" data-testid="table-accounts">
          <caption className="muted-text">
            {accounts.length} cuenta{accounts.length === 1 ? "" : "s"} local
            {accounts.length === 1 ? "" : "es"} en el sistema
          </caption>
          <thead>
            <tr>
              <th scope="col">Cuenta</th>
              <th scope="col">Estado</th>
              <th scope="col">Segundo factor</th>
              <th scope="col">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((c) => (
              <tr key={c.userId} data-testid={`account-${c.userId}`}>
                <th scope="row">
                  {c.userId}
                  <span className="muted-text"> · {c.email}</span>
                </th>
                <td>
                  <span
                    className="pastilla-estado"
                    data-status={c.bloqueada ? "bloqueada" : "activa"}
                  >
                    {c.bloqueada ? "Bloqueada" : "Activa"}
                  </span>
                  {c.intentosFallidos > 0 ? (
                    <span className="muted-text">
                      {" "}
                      · {c.intentosFallidos} intentos fallidos
                    </span>
                  ) : null}
                </td>
                <td>
                  {/*
                  Una cuenta local sin TOTP es un hueco, no un detalle: 4.7.2 lo trata como
                  obligatorio precisamente porque estas cuentas no heredan el MFA de Azure AD.
                */}
                  {c.tieneSegundoFactor ? (
                    "TOTP configurado"
                  ) : (
                    <strong data-testid={`without-mfa-${c.userId}`}>
                      Sin segundo factor
                    </strong>
                  )}
                </td>
                <td className="editor__actions">
                  <button
                    type="button"
                    className="button-link"
                    data-testid={`unlock-${c.userId}`}
                    disabled={trabajando || !c.bloqueada}
                    onClick={() => void actuar("desbloquear", c.email)}
                  >
                    Desbloquear
                  </button>
                  <button
                    type="button"
                    className="button-link"
                    data-testid={`reset-${c.userId}`}
                    disabled={trabajando}
                    onClick={() => void actuar("restablecer", c.email)}
                  >
                    Restablecer contrasena
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
