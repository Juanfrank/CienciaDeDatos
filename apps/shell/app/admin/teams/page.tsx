import { AdminAccess } from '../../../src/components/admin/AdminAccess';
import { TeamsTable } from '../../../src/components/admin/TeamsTable';
import { accesoDeQuienesAdministran, administradores } from '../../../src/server/admin';
import { listTeams } from '../../../src/server/context';
import { translator } from '../../../src/server/locale';
import { paginaDeAdmin } from '../../../src/server/admin';

export const dynamic = 'force-dynamic';

/**
 * Los equipos, en tabla — secciones 4.10.2 y 4.10.8.
 *
 * Lo que cada equipo alcanza y quien esta dentro viven en su propia pantalla. Aqui solo estan la
 * pregunta que se hace al entrar —cuantos son— y las tres acciones que llevan al resto.
 */
export default async function TeamPage() {
  // Quien puede ver ESTA pagina, dicho aqui y no heredado del layout.
  await paginaDeAdmin();

  const [t, equipos, quienesAdministran, acceso] = await Promise.all([
    translator(),
    listTeams(),
    administradores(),
    accesoDeQuienesAdministran(),
  ]);

  return (
    <section>
      <h2>{t('admin.teams.title')}</h2>
      <p className="muted-text">{t('admin.teams.intro')}</p>

      {/*
        Quien administra, a la vista y antes de tocar nada.

        El servidor impide dejar la aplicacion sin ningun Administrador, pero eso solo avisa
        cuando ya se esta intentando. Con uno solo, el sistema esta a un cambio de configuracion
        —o a una baja— de necesitar el procedimiento de acceso de emergencia, y eso no se ve en
        ninguna otra pantalla.
      */}
      <p
        className={quienesAdministran.length < 2 ? 'aviso notice-atencion' : 'aviso'}
        data-testid="administradores"
      >
        {quienesAdministran.length === 1
          ? t('admin.teams.onlyOneAdmin', { quien: quienesAdministran[0] ?? '' })
          : t('admin.teams.admins', { quienes: t.lista(quienesAdministran) })}
      </p>

      {/*
        Y si ademas pueden ENTRAR, que es otra pregunta.

        Conservar el rol satisface la invariante del servidor mientras la institucion sigue de
        hecho sin acceso: una cuenta bloqueada cuenta como Administrador para
        `wouldLeaveNoAdministrator` y no puede iniciar sesion.
      */}
      <AdminAccess acceso={acceso} t={t} />

      <TeamsTable
        equipos={equipos.map((e) => ({
          id: e.id,
          nombre: e.name,
          miembros: e.members.length,
        }))}
      />
    </section>
  );
}
