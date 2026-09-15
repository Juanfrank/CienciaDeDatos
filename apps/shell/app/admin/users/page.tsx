import Link from 'next/link';
import { roleInTeam } from '@app/access-control';
import { UsersTable, type FilaDeUsuario } from '../../../src/components/admin/UsersTable';
import { listTeams, listUsers } from '../../../src/server/context';
import { roleMoreHeightOf } from '../../../src/server/admin';
import { AVAILABLE_MAIL, canalDeRestablecimiento, localesAccounts } from '../../../src/server/identity';
import { translator } from '../../../src/server/locale';

export const dynamic = 'force-dynamic';

/**
 * Las personas del directorio, que pueden y como entran — secciones 4.10.1, 4.10.2 y 4.7.2.
 *
 * El rol general no se asigna: se DEDUCE del rol mas alto que la persona tenga en alguno de sus
 * equipos, que es la regla que aplica el guardian. Una columna editable aparte terminaria diciendo
 * «visor» junto a alguien que administra por pertenecer a un equipo donde es administrador.
 *
 * Las cuentas locales estaban en su propia seccion, con su propia tabla de las mismas personas.
 * Quien busca por que alguien no puede entrar no tiene por que saber de antemano si su cuenta es
 * local o institucional: es justo lo que viene a averiguar.
 */
export default async function UsuariosPage() {
  const [t, usuarios, equipos, cuentas] = await Promise.all([
    translator(),
    listUsers(),
    listTeams(),
    localesAccounts(),
  ]);

  const porUsuario = new Map(cuentas.map((c) => [c.userId, c]));
  const filas: FilaDeUsuario[] = await Promise.all(
    usuarios.map(async (u): Promise<FilaDeUsuario> => {
      const cuenta = porUsuario.get(u.userId);
      return {
        userId: u.userId,
        nombre: u.displayName ?? u.userId,
        mail: u.mail ?? null,
        role: await roleMoreHeightOf(u.userId),
        equipos: equipos.flatMap((e) => {
          const role = roleInTeam(e, u.userId);
          // `flatMap` y no `map().filter()`: el filtro deja el tipo con el `undefined` dentro, y
          // el predicado que lo quitaba era una afirmacion, no una comprobacion.
          return role === undefined ? [] : [{ id: e.id, nombre: e.name, role }];
        }),
        cuenta: cuenta
          ? {
              email: cuenta.email,
              bloqueada: cuenta.bloqueada,
              intentosFallidos: cuenta.intentosFallidos,
              tieneSegundoFactor: cuenta.tieneSegundoFactor,
            }
          : null,
      };
    }),
  );

  return (
    <section>
      <h2>{t('admin.users.title')}</h2>
      <p className="muted-text">{t('admin.users.intro')}</p>

      {/* El rol de la columna no se explica solo: aqui se ve QUE puede cada uno. */}
      <p>
        <Link href="/admin/users/permissions" data-testid="ir-a-permisos">
          {t('admin.permissions.title')}
        </Link>
      </p>

      {/*
        Por donde sale un restablecimiento, ANTES de emitir ninguno.
        Sin correo institucional configurado el codigo se ensena en pantalla y quien administra
        responde de haber verificado a quien se lo entrega. Eso tiene que constar antes de pulsar,
        no en el mensaje que aparece despues.
      */}
      <p
        className={AVAILABLE_MAIL ? 'aviso notice-ok' : 'aviso notice-atencion'}
        data-testid="canal-restablecimiento"
      >
        {t('admin.accounts.channel', { canal: canalDeRestablecimiento.name })}{' '}
        {AVAILABLE_MAIL ? t('admin.accounts.channel.mail') : t('admin.accounts.channel.mediated')}
      </p>

      <UsersTable usuarios={filas} />

      <p className="muted-text">
        {t('admin.users.footer')}{' '}
        <Link href="/admin/teams">{t('admin.users.footer.link')}</Link>
      </p>
    </section>
  );
}
