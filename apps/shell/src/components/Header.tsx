import Link from 'next/link';
import { defaultIdentity } from '@app/design-tokens';
import { can } from '@app/access-control';
import { isAdministrator, roleMoreHeightOf } from '../server/admin';
import { findTeam } from '../server/context';
import type { ShellSession } from '../server/session';
import { ToggleSidebar } from './ToggleSidebar';
import { listUsers } from '../server/context';
import { AccountMenu, type AccountEntry } from './AccountMenu';

/** Cromo de cabecera de la aplicacion. */
export async function Header({ sesion }: { sesion: ShellSession }) {
  const equipo = await findTeam(sesion.activeTeamId);

  // El enlace solo se dibuja para quien puede usarlo. Ocultarlo no protege nada —eso lo hace el
  // guardian del backend— pero no tiene sentido ofrecer una puerta cerrada.
  const manageCan = await isAdministrator(sesion.userId);
  // El nombre y el correo salen del directorio de gobierno, no de las credenciales: la misma
  // persona entra hoy con contrasena local y manana con Azure AD, y se sigue llamando igual.
  const perfil = (await listUsers()).find((u) => u.userId === sesion.userId);
  const editCan = can(await roleMoreHeightOf(sesion.userId), 'crear-editar-modulos-borrador');

  const entradas: AccountEntry[] = [
    { href: '/avisos', label: 'Avisos', icono: 'notice', prueba: 'link-avisos', cuentaAvisos: true },
    ...(editCan
      ? [{ href: '/editor', label: 'Editor de modulos', icono: 'content', prueba: 'link-editor' } as const]
      : []),
    ...(manageCan
      ? [{ href: '/admin', label: 'Administracion', icono: 'llave', prueba: 'link-admin' } as const]
      : []),
  ];

  return (
    <header className="cabecera">
      <div className="header__mark">
        <ToggleSidebar />
        {/*
          El emblema es DECORATIVO y por eso lleva alt vacio: el nombre de la institucion esta
          justo al lado como texto, y darle tambien un texto alternativo haria que un lector de
          pantalla anunciara dos veces lo mismo.
        */}
        <img
          className="header__emblema"
          src={defaultIdentity.emblem.src}
          width={defaultIdentity.emblem.width}
          height={defaultIdentity.emblem.height}
          alt=""
        />
        <div className="header__texts">
          <Link href="/" className="header__title">
            Capa de visualizacion
          </Link>
          <span className="header__subtitle" data-testid="institucion">
            {defaultIdentity.name}
            {equipo ? ` · ${equipo.name}` : ''}
          </span>
        </div>
      </div>

      <div className="header__actions">
        {/*
          Todo lo que no es navegar por los datos vive en el menu de la cuenta.
          La cabecera tenia cuatro controles compitiendo con el arbol y con el titulo del modulo;
          lo que una persona hace aqui cien veces es mirar datos, y una vez al dia entrar al
          editor o a administracion.

          Cada entrada sigue dibujandose solo para quien puede usarla. Ocultarla no protege nada
          —eso lo hace el guardian del backend— pero no tiene sentido ofrecer una puerta cerrada.
        */}
        <AccountMenu
          user={sesion.userId}
          {...(perfil?.displayName ? { displayName: perfil.displayName } : {})}
          {...(perfil?.mail ? { mail: perfil.mail } : {})}
          entries={entradas}
        />
      </div>
    </header>
  );
}
