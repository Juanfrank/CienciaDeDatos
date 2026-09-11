import type { Metadata } from 'next';
import { defaultTheme, toCssVariables } from '@app/design-tokens';
import { navigationFor, roleOf, teamsOf, findTeam, users } from '../src/server/contexto';
import { obtenerSesion } from '../src/server/sesion';
import { SelectorDeEquipo } from '../src/components/SelectorDeEquipo';
import { ArbolNavegacion } from '../src/components/ArbolNavegacion';
import './globals.css';

export const metadata: Metadata = {
  title: 'Capa de visualizacion',
  description: 'Reporting institucional',
};

/** El tema organizacional (4.3) se inyecta como variables CSS en la raiz del documento. */
const variables = toCssVariables(defaultTheme);

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const sesion = await obtenerSesion();
  const equipo = findTeam(sesion.activeTeamId);
  const navegacion = navigationFor(sesion.activeTeamId);

  const equipos = teamsOf(sesion.userId).map((t) => ({
    id: t.id,
    name: t.name,
    role: roleOf(sesion.userId, t.id),
  }));

  return (
    <html lang="es">
      <body style={variables as React.CSSProperties}>
        <div className="disposicion">
          <header className="cabecera">
            <div className="cabecera__marca">
              <span className="cabecera__titulo">Capa de visualizacion</span>
              <span className="cabecera__subtitulo">Reporting institucional</span>
            </div>
            {/* El equipo activo es visible en todo momento, como exige 4.10.2. */}
            <SelectorDeEquipo
              equipos={equipos}
              equipoActivo={sesion.activeTeamId}
              usuarios={users.map((u) => ({ id: u.userId, name: u.userId }))}
              usuarioActivo={sesion.userId}
            />
          </header>

          <div className="cuerpo">
            <nav className="lateral" aria-label="Navegacion de modulos">
              <p className="lateral__titulo">
                {equipo?.name ?? 'Sin equipo'}
              </p>
              <ArbolNavegacion nodos={navegacion.tree} />
              {navegacion.tree.length === 0 ? (
                <p className="texto-atenuado">Este equipo no tiene modulos concedidos.</p>
              ) : null}
            </nav>
            <main className="principal">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
