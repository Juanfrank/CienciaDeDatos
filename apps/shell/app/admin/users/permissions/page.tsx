import Link from 'next/link';
import type { MessageKey } from '@app/i18n';
import { APP_ROLES, CAPABILITIES, rolesThatCan } from '@app/access-control';
import { translator } from '../../../../src/server/locale';
import { paginaDeAdmin } from '../../../../src/server/admin';

export const dynamic = 'force-dynamic';

/**
 * La matriz de permisos de 4.10.1, dibujada desde el codigo que decide.
 *
 * Estaba escrita, probada y era invisible: `MATRIX` es privada de `@app/access-control`, asi que
 * quien administra no tenia forma de ver que puede cada rol — y la unica alternativa habria sido
 * copiar la tabla a mano en el panel. Una copia a mano de una matriz de permisos es justo la
 * clase de cosa que se queda vieja sin que nadie se entere, y la que mas duele que lo haga.
 *
 * Los roles NO se editan aqui, y no es un descuido: el contrato los fija en tres y los declara
 * no configurables. Esta pagina explica, no configura.
 */
export default async function PermissionsPage() {
  // Quien puede ver ESTA pagina, dicho aqui y no heredado del layout.
  await paginaDeAdmin();

  const t = await translator();

  return (
    <section>
      <h2>{t('admin.permissions.title')}</h2>
      <p className="muted-text">{t('admin.permissions.intro')}</p>

      <p>
        <Link href="/admin/users">← {t('admin.users.title')}</Link>
      </p>

      <div className="container-table">
        <table className="tabla" data-testid="permissions-matrix">
          <thead>
            <tr>
              <th scope="col">{t('admin.permissions.column.capability')}</th>
              {APP_ROLES.map((rol) => (
                <th scope="col" key={rol}>
                  {t(`role.${rol}` as MessageKey)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CAPABILITIES.map((cap) => {
              const puede = rolesThatCan(cap);
              return (
                <tr key={cap} data-testid={`cap-${cap}`}>
                  <th scope="row">{t(`cap.${cap}` as MessageKey)}</th>
                  {APP_ROLES.map((rol) => (
                    <td key={rol} data-puede={puede.includes(rol) ? 'si' : 'no'}>
                      {/*
                        Se escribe la palabra, no un simbolo. Un «✓» sin texto lo lee un lector de
                        pantalla como «marca de verificacion» o no lo lee, y en una tabla de
                        permisos la diferencia entre si y no es lo unico que importa (4.9).
                      */}
                      {puede.includes(rol)
                        ? t('admin.permissions.yes')
                        : t('admin.permissions.no')}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="aviso notice-ok" data-testid="permissions-separation">
        {t('admin.permissions.separation')}
      </p>
      <p className="aviso notice-ok" data-testid="permissions-last-admin">
        {t('admin.permissions.lastAdmin')}
      </p>
    </section>
  );
}
