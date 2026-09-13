import { CORREO_DISPONIBLE, canalDeRestablecimiento, cuentasLocales } from '../../../src/server/identidad';
import { CuentasLocales } from '../../../src/components/admin/CuentasLocales';

export const dynamic = 'force-dynamic';

/** Cuentas locales — seccion 4.7.2. */
export default async function PaginaCuentas() {
  return (
    <section>
      <h2>Cuentas locales</h2>
      <p className="texto-atenuado">
        Son la EXCEPCION, no la via por defecto: cualquier persona con identidad institucional en
        Azure AD debe entrar por ahi, porque asi hereda el SSO, el MFA y el acceso condicional que
        la institucion ya gestiona. Estas cuentas no heredan nada de eso, y por eso llevan segundo
        factor obligatorio y se auditan aparte.
      </p>

      <CuentasLocales
        cuentas={await cuentasLocales()}
        canal={canalDeRestablecimiento.name}
        correoDisponible={CORREO_DISPONIBLE}
      />
    </section>
  );
}
