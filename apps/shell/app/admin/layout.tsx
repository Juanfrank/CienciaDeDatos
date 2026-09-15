import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SIDEBAR_ID } from '../../src/components/CollapsibleNavigation';
import { AdminRail, CurrentSection } from '../../src/components/admin/AdminRail';
import { can } from '@app/access-control';
import { isAdministrator, roleMoreHeightOf } from '../../src/server/admin';
import { indicadoresDeAdmin } from '../../src/server/admin';
import { pageSessionRequire } from '../../src/server/session';
import { translator } from '../../src/server/locale';

/** Panel de administracion — seccion 4.10.8. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const t = await translator();
  const sesion = await pageSessionRequire();

  /*
   * El layout ya no es el UNICO guardian.
   *
   * Lo era, y eso significaba que ninguna pagina declaraba quien puede verla: abrirlo un poco
   * habria abierto de golpe equipos, ambitos y auditoria. Ahora cada pagina lleva el suyo
   * —`paginaDeAdmin`, o `paginaDeModulos` en la tabla de modulos— y esto solo decide si se dibuja
   * el marco. Dos puertas y no una: la de fuera deja pasar a quien tiene algo que hacer aqui
   * dentro, y la de cada sala dice si esa sala es suya.
   *
   * Entra tambien quien puede crear borradores, porque la tabla de modulos es ahora su puerta: el
   * editor dejo de tener entrada propia en el menu de usuario.
   */
  const esAdmin = await isAdministrator(sesion.userId);
  const role = await roleMoreHeightOf(sesion.userId);
  if (!esAdmin && !can(role, 'crear-editar-modulos-borrador')) {
    // Se redirige a una ruta FUERA de este layout, porque redirigir a una de dentro entraria en
    // bucle. Para una pagina, redirigir es lo idiomatico; lo que devuelve 403 es la API.
    redirect('/admin-without-permission');
  }

  return (
    <div className="admin">
      <header className="admin__header">
        {/*
          La cabecera dice DONDE se esta, no por que existe el panel.
          Decia «superficie de gestion, separada de los modulos de negocio», que es la
          justificacion del contrato — util una vez, inutil las demas. Con el nombre de la seccion
          al lado, la pagina sigue orientando aunque el carril este plegado, que es como arranca en
          pantalla estrecha.
        */}
        <div className="admin__path">
          <h1>
            <Link href="/admin">{t('chrome.admin')}</Link>
          </h1>
          <CurrentSection />
        </div>
        <Link href="/" className="boton-contorno" data-testid="volver-a-modulos">
          {t('chrome.backToModules')}
        </Link>
      </header>

      <div className="admin__body">
        <AdminRail id={SIDEBAR_ID} indicadores={await indicadoresDeAdmin()} soloModulos={!esAdmin} />
        <main className="admin__principal" id="contenido-admin" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
