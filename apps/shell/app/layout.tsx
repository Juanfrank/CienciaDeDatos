import type { Metadata } from 'next';
import Link from 'next/link';
import { defaultTheme, toCssVariables } from '@app/design-tokens';
import { esAdministrador } from '../src/server/admin';
import { findTeam, listUsers, roleOf, teamsOf } from '../src/server/contexto';
import { obtenerSesion } from '../src/server/sesion';
import { Campana } from '../src/components/Campana';
import { SelectorDeEquipo } from '../src/components/SelectorDeEquipo';
import './globals.css';

export const metadata: Metadata = {
  title: 'Capa de visualizacion',
  description: 'Reporting institucional',
};

/** El tema organizacional (4.3) se inyecta como variables CSS en la raiz del documento. */
const variables = toCssVariables(defaultTheme);

/**
 * Cromo comun a toda la aplicacion: documento, tema y cabecera.
 *
 * La navegacion de MODULOS no vive aqui, sino en el grupo de rutas (modulos). El panel de
 * administracion es "una superficie de gestion dedicada, SEPARADA de los modulos de negocio"
 * (4.10.8), asi que no debe arrastrar el arbol de modulos a un lado mientras se administra.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const sesion = await obtenerSesion();
  const equipo = findTeam(sesion.activeTeamId);

  // El enlace solo se dibuja para quien puede usarlo. Ocultarlo no protege nada —eso lo hace el
  // guardian del backend— pero no tiene sentido ofrecer una puerta cerrada.
  const puedeAdministrar = esAdministrador(sesion.userId);

  const equipos = teamsOf(sesion.userId).map((t) => ({
    id: t.id,
    name: t.name,
    role: roleOf(sesion.userId, t.id),
  }));

  return (
    <html lang="es">
      <body style={variables as React.CSSProperties}>
        <header className="cabecera">
          <div className="cabecera__marca">
            <Link href="/" className="cabecera__titulo">
              Capa de visualizacion
            </Link>
            <span className="cabecera__subtitulo">
              Reporting institucional{equipo ? ` · ${equipo.name}` : ''}
            </span>
          </div>

          <div className="cabecera__acciones">
            <Campana />
            {puedeAdministrar ? (
              <Link href="/admin" className="boton-enlace" data-testid="enlace-admin">
                Administracion
              </Link>
            ) : null}
            {/* El equipo activo es visible en todo momento, como exige 4.10.2. */}
            <SelectorDeEquipo
              equipos={equipos}
              equipoActivo={sesion.activeTeamId}
              usuarios={listUsers().map((u) => ({ id: u.userId, name: u.userId }))}
              usuarioActivo={sesion.userId}
            />
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
