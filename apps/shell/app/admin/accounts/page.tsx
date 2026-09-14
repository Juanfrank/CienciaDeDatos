import { AVAILABLE_MAIL, canalDeRestablecimiento, localesAccounts } from '../../../src/server/identity';
import { LocalesAccounts } from '../../../src/components/admin/LocalAccounts';

export const dynamic = 'force-dynamic';

/** Cuentas locales — seccion 4.7.2. */
export default async function AccountsPage() {
  return (
    <section>
      <h2>Cuentas locales</h2>
      <p className="muted-text">
        Son la EXCEPCION, no la via por defecto: cualquier persona con identidad institucional en
        Azure AD debe entrar por ahi, porque asi hereda el SSO, el MFA y el acceso condicional que
        la institucion ya gestiona. Estas cuentas no heredan nada de eso, y por eso llevan segundo
        factor obligatorio y se auditan aparte.
      </p>

      <LocalesAccounts
        accounts={await localesAccounts()}
        canal={canalDeRestablecimiento.name}
        availableMail={AVAILABLE_MAIL}
      />
    </section>
  );
}
