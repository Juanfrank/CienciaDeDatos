import type { Metadata } from 'next';
import { Montserrat } from 'next/font/google';
import Link from 'next/link';
import { defaultIdentity, defaultTheme, toCssVariables } from '@app/design-tokens';
import { esAdministrador } from '../src/server/admin';
import { findTeam, listUsers, roleOf, teamsOf } from '../src/server/contexto';
import { obtenerSesion } from '../src/server/sesion';
import { Campana } from '../src/components/Campana';
import { SelectorDeEquipo } from '../src/components/SelectorDeEquipo';
import './globals.css';

export const metadata: Metadata = {
  title: 'Capa de visualizacion',
  description: `Reporting institucional — ${defaultIdentity.name}`,
};

/**
 * Montserrat, la tipografia institucional.
 *
 * Se carga con `next/font`, que la descarga EN TIEMPO DE CONSTRUCCION y la sirve desde el propio
 * origen. Un `<link>` a fonts.googleapis.com haria que el navegador hablase con un tercero, y
 * eso incumple el principio 1 —el navegador solo habla con esta aplicacion—; hay una prueba de
 * navegador que lo comprueba y que ese enlace romperia. De paso evita el parpadeo de la fuente y
 * una peticion externa en cada carga.
 */
const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
  // La pila de alternativas la fija el tema; aqui solo se declara que variable la lleva.
  variable: '--font-montserrat',
});

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
    <html lang="es" className={montserrat.variable}>
      <body style={variables as React.CSSProperties}>
        <header className="cabecera">
          <div className="cabecera__marca">
            {/*
              El emblema es DECORATIVO y por eso lleva alt vacio: el nombre de la institucion
              esta justo al lado como texto, y darle tambien un texto alternativo haria que un
              lector de pantalla anunciara dos veces lo mismo.
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
            <SelectorDeEquipo
              equipos={equipos}
              equipoActivo={sesion.activeTeamId}
              usuarios={(await listUsers()).map((u) => ({ id: u.userId, name: u.userId }))}
              usuarioActivo={sesion.userId}
            />
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
