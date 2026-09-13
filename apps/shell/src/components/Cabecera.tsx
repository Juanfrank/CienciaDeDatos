import Link from 'next/link';
import { defaultIdentity } from '@app/design-tokens';
import { can } from '@app/access-control';
import { esAdministrador, rolMasAltoDe } from '../server/admin';
import { findTeam } from '../server/context';
import type { SesionShell } from '../server/session';
import { AlternarLateral } from './AlternarLateral';
import { Campana } from './Campana';
import { CerrarSesion } from './CerrarSesion';

/** Cromo de cabecera de la aplicacion. */
export async function Cabecera({ sesion }: { sesion: SesionShell }) {
  const equipo = await findTeam(sesion.activeTeamId);

  // El enlace solo se dibuja para quien puede usarlo. Ocultarlo no protege nada —eso lo hace el
  // guardian del backend— pero no tiene sentido ofrecer una puerta cerrada.
  const puedeAdministrar = await esAdministrador(sesion.userId);
  const puedeEditar = can(await rolMasAltoDe(sesion.userId), 'crear-editar-modulos-borrador');

  return (
    <header className="cabecera">
      <div className="cabecera__marca">
        <AlternarLateral />
        {/*
          El emblema es DECORATIVO y por eso lleva alt vacio: el nombre de la institucion esta
          justo al lado como texto, y darle tambien un texto alternativo haria que un lector de
          pantalla anunciara dos veces lo mismo.
        */}
        <img
          className="cabecera__emblema"
          src={defaultIdentity.emblem.src}
          width={defaultIdentity.emblem.width}
          height={defaultIdentity.emblem.height}
          alt=""
        />
        <div className="cabecera__textos">
          <Link href="/" className="cabecera__titulo">
            Capa de visualizacion
          </Link>
          <span className="cabecera__subtitulo" data-testid="institucion">
            {defaultIdentity.name}
            {equipo ? ` · ${equipo.name}` : ''}
          </span>
        </div>
      </div>

      <div className="cabecera__acciones">
        <Campana />
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
        <CerrarSesion user={sesion.userId} />
      </div>
    </header>
  );
}
