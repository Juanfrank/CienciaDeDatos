import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SIDEBAR_ID } from '../../src/components/CollapsibleNavigation';
import { AdminRail, SeccionActual } from '../../src/components/admin/AdminRail';
import { esAdministrador } from '../../src/server/admin';
import { indicadoresDeAdmin } from '../../src/server/admin';
import { exigirSesionDePagina } from '../../src/server/session';

/** Panel de administracion — seccion 4.10.8. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sesion = await exigirSesionDePagina();

  if (!(await esAdministrador(sesion.userId))) {
    // Sin permiso no se dibuja nada del panel. Se redirige a una ruta FUERA de este layout,
    // porque redirigir a una ruta de dentro entraria en bucle.
    //
    // Para una pagina, redirigir es el comportamiento idiomatico; lo que devuelve 403 es la API
    // (/api/admin/*), que es la que importa cuando alguien se salta la interfaz.
    redirect('/admin-sin-permiso');
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
            <Link href="/admin">Administracion</Link>
          </h1>
          <SeccionActual />
        </div>
        <Link href="/" className="boton-contorno" data-testid="volver-a-modulos">
          Volver a los modulos
        </Link>
      </header>

      <div className="admin__body">
        <AdminRail id={SIDEBAR_ID} indicadores={await indicadoresDeAdmin()} />
        <main className="admin__principal" id="contenido-admin" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
