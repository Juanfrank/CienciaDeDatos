import Link from 'next/link';
import { defaultIdentity } from '@app/design-tokens';
import { can } from '@app/access-control';
import { isAdministrator, roleMoreHeightOf } from '../server/admin';
import { findTeam } from '../server/context';
import type { ShellSession } from '../server/session';
import { ToggleSidebar } from './ToggleSidebar';
import { Bell } from './Bell';
import { listUsers } from '../server/context';
import { CloseSession } from './CloseSession';

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
        <Bell />
        {editCan ? (
          <Link href="/editor" className="button-link" data-testid="link-editor">
            Editor
          </Link>
        ) : null}
        {manageCan ? (
          <Link href="/admin" className="button-link" data-testid="link-admin">
            Administracion
          </Link>
        ) : null}
        <CloseSession
          user={sesion.userId}
          {...(perfil?.displayName ? { displayName: perfil.displayName } : {})}
          {...(perfil?.mail ? { mail: perfil.mail } : {})}
        />
      </div>
    </header>
  );
}
