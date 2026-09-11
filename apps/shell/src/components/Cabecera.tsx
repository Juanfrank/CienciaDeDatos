import Link from 'next/link';
import { defaultIdentity } from '@app/design-tokens';
import { esAdministrador } from '../server/admin';
import { findTeam, roleOf, teamsOf } from '../server/contexto';
import type { SesionShell } from '../server/sesion';
import { Campana } from './Campana';
import { CerrarSesion } from './CerrarSesion';
import { SelectorDeEquipo } from './SelectorDeEquipo';

/**
 * Cromo de cabecera de la aplicacion.
 *
 * Sale del layout raiz porque todo lo que lleva —equipo activo, campana, enlace de
 * administracion— presupone que hay alguien dentro. La pantalla de acceso comparte el layout
 * raiz y no debe mostrar nada de esto.
 */
export async function Cabecera({ sesion }: { sesion: SesionShell }) {
  const equipo = await findTeam(sesion.activeTeamId);

  // El enlace solo se dibuja para quien puede usarlo. Ocultarlo no protege nada —eso lo hace el
  // guardian del backend— pero no tiene sentido ofrecer una puerta cerrada.
  const puedeAdministrar = await esAdministrador(sesion.userId);

  const equipos = await Promise.all(
    (await teamsOf(sesion.userId)).map(async (t) => ({
      id: t.id,
      name: t.name,
      role: await roleOf(sesion.userId, t.id),
    })),
  );

  return (
    <header className="cabecera">
      <div className="cabecera__marca">
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
        {puedeAdministrar ? (
          <Link href="/admin" className="boton-enlace" data-testid="enlace-admin">
            Administracion
          </Link>
        ) : null}
        {/* El equipo activo es visible en todo momento, como exige 4.10.2. */}
        <SelectorDeEquipo equipos={equipos} equipoActivo={sesion.activeTeamId} />
        <CerrarSesion usuario={sesion.userId} />
      </div>
    </header>
  );
}
