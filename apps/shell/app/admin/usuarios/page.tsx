import Link from 'next/link';
import { roleInTeam } from '@app/access-control';
import { listTeams, listUsers } from '../../../src/server/context';
import { roleMoreHeightOf } from '../../../src/server/admin';
import { translator } from '../../../src/server/locale';

export const dynamic = 'force-dynamic';

/**
 * Las personas del directorio y que pueden hacer — secciones 4.10.1 y 4.10.2.
 *
 * El rol general no se asigna: se DEDUCE del rol mas alto que la persona tenga en alguno de sus
 * equipos, que es la regla que aplica el guardian. Una columna editable aparte terminaria diciendo
 * «visor» junto a alguien que administra por pertenecer a un equipo donde es administrador.
 */
export default async function UsuariosPage() {
  const [t, usuarios, equipos] = await Promise.all([translator(), listUsers(), listTeams()]);
  const filas = await Promise.all(
    usuarios.map(async (u) => ({
      usuario: u,
      roleGeneral: await roleMoreHeightOf(u.userId),
      pertenencias: equipos
        .map((e) => ({ equipo: e, role: roleInTeam(e, u.userId) }))
        .filter((p) => p.role !== undefined),
    })),
  );

  return (
    <section>
      <h2>{t('admin.usuarios.titulo')}</h2>
      <p className="muted-text">{t('admin.usuarios.intro')}</p>

      <table className="tabla" data-testid="tabla-usuarios">
        <thead>
          <tr>
            <th scope="col">{t('admin.usuarios.columna.persona')}</th>
            <th scope="col">{t('admin.usuarios.columna.rol')}</th>
            <th scope="col">{t('admin.usuarios.columna.equipos')}</th>
            <th scope="col">{t('admin.usuarios.columna.ambito')}</th>
            <th scope="col" />
          </tr>
        </thead>
        <tbody>
          {filas.map(({ usuario, roleGeneral, pertenencias }) => (
            <tr key={usuario.userId} data-testid={`usuario-${usuario.userId}`}>
              <th scope="row">
                {usuario.displayName ?? usuario.userId}
                <span className="muted-text">
                  {usuario.mail ? ` · ${usuario.mail}` : ''} · {usuario.userId}
                </span>
              </th>
              <td data-testid={`usuario-${usuario.userId}-rol`}>{roleGeneral}</td>
              <td>
                {pertenencias.length === 0 ? (
                  /*
                   * Sin equipo no se ve NADA: el acceso se concede por equipo. Se dice aqui
                   * porque es la explicacion de un «no veo nada» que si no se busca en el codigo.
                   */
                  <span
                    className="notice-atencion"
                    data-testid={`usuario-${usuario.userId}-huerfano`}
                  >
                    {t('admin.usuarios.huerfano')}
                  </span>
                ) : (
                  <ul className="inline-list">
                    {pertenencias.map(({ equipo, role }) => (
                      <li key={equipo.id}>
                        <Link href="/admin/equipos">{equipo.name}</Link> ({role})
                      </li>
                    ))}
                  </ul>
                )}
              </td>
              <td>
                {usuario.personalScope || usuario.personalModuleScopeOverrides ? (
                  <Link href="/admin/ambitos" data-testid={`usuario-${usuario.userId}-ambito`}>
                    {t('admin.usuarios.ambitoPropio')}
                  </Link>
                ) : (
                  <span className="muted-text">{t('admin.usuarios.ambitoHeredado')}</span>
                )}
              </td>
              <td>
                <Link
                  href={`/admin/quien-ve-que?usuario=${encodeURIComponent(usuario.userId)}`}
                  className="button-link"
                  data-testid={`usuario-${usuario.userId}-que-ve`}
                >
                  {t('admin.usuarios.queVe')}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="muted-text">
        {t('admin.usuarios.pie')}{' '}
        <Link href="/admin/equipos">{t('admin.usuarios.pie.enlace')}</Link>
      </p>
    </section>
  );
}
