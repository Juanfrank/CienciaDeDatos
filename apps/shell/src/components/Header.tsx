import Link from 'next/link';
import { defaultIdentity } from '@app/design-tokens';
import { can } from '@app/access-control';
import { esAdministrador, rolMasAltoDe } from '../server/admin';
import { findTeam } from '../server/context';
import type { SesionShell } from '../server/session';
import { ToggleSidebar } from './ToggleSidebar';
import { Bell } from './Bell';
import { CloseSession } from './CloseSession';

/** Cromo de cabecera de la aplicacion. */
export async function Header({ sesion }: { sesion: SesionShell }) {
  const equipo = await findTeam(sesion.activeTeamId);

  // El enlace solo se dibuja para quien puede usarlo. Ocultarlo no protege nada —eso lo hace el
  // guardian del backend— pero no tiene sentido ofrecer una puerta cerrada.
  const puedeAdministrar = await esAdministrador(sesion.userId);
  const puedeEditar = can(await rolMasAltoDe(sesion.userId), 'crear-editar-modulos-borrador');

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
        {puedeEditar ? (
          <Link href="/editor" className="boton-enlace" data-testid="enlace-editor">
            Editor
          </Link>
        ) : null}
        {puedeAdministrar ? (
          <Link href="/admin" className="boton-enlace" data-testid="enlace-admin">
            Administracion
          </Link>
        ) : null}
        <CloseSession user={sesion.userId} />
      </div>
    </header>
  );
}
