import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ID_LATERAL } from '../../src/components/NavegacionPlegable';
import { EnlaceDeSeccion } from '../../src/components/admin/EnlaceDeSeccion';
import { esAdministrador } from '../../src/server/admin';
import { exigirSesionDePagina } from '../../src/server/sesion';

/**
 * Panel de administracion — seccion 4.10.8.
 *
 * "El rol Administrador necesita una superficie de gestion DEDICADA, SEPARADA de los modulos de
 * negocio." De ahi que viva bajo /admin con su propia disposicion.
 *
 * La comprobacion de permiso se hace aqui y ademas en cada handler de /api/admin. Dos veces a
 * proposito: esta evita que se dibuje la pagina, la otra evita que sirva de algo saltarsela.
 */
const SECCIONES = [
  { href: '/admin/arbol', label: 'Organizacion general', desc: 'Carpetas, modulos y papelera' },
  { href: '/admin/equipos', label: 'Equipos y membresia', desc: 'Accesos y roles' },
  { href: '/admin/paquetes', label: 'Paquetes visuales', desc: 'Reagrupacion por audiencia' },
  { href: '/admin/ambitos', label: 'Ambitos de acceso', desc: 'RLS de negocio' },
  { href: '/admin/quien-ve-que', label: 'Quien ve que', desc: 'Auditar antes de publicar' },
  { href: '/admin/cuentas', label: 'Cuentas locales', desc: 'La excepcion, no la via por defecto' },
  { href: '/admin/auditoria', label: 'Auditoria', desc: 'Cambios y excepciones' },
];

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
      <header className="admin__cabecera">
        <div>
          <h1>Administracion</h1>
          <p className="texto-atenuado">
            Superficie de gestion, separada de los modulos de negocio
          </p>
        </div>
        <Link href="/" className="boton-enlace" data-testid="volver-a-modulos">
          Volver a los modulos
        </Link>
      </header>

      <div className="admin__cuerpo">
        <nav
          className="admin__nav"
          id={ID_LATERAL}
          aria-label="Secciones de administracion"
        >
          <ul>
            {SECCIONES.map((s) => (
              <li key={s.href}>
                <EnlaceDeSeccion href={s.href} label={s.label} desc={s.desc} />
              </li>
            ))}
          </ul>
        </nav>
        <main className="admin__principal">{children}</main>
      </div>
    </div>
  );
}
